


Math.log10 = Math.log10 || function(x) {
  return Math.log(x) * Math.LOG10E;
};

if (isMobile()) {
    $("body").addClass("isMobile")
}



var AppState = Backbone.Model.extend({
    toggleSelectedRegion: function(region){
        var selectedRegion = this.get("selectedRegion")
        if (selectedRegion === region) {
            this.set("selectedRegion", null)
        } else {
            this.set("selectedRegion", region)
        }
    }
})
var appState = new AppState();

var lastTrackedIndustry = null;
var lastTrackedRegion = null;

function getUrlName(str){
    str = str.replace(/ /g, "-").toLowerCase().replace(/[^a-z\-]/g, "")
    if (str.length > 30) {
        var parts = str.split("-")
        str = ""
        while (str.length < 30) {
            str += parts.shift() + "-"
        }
        str = str.slice(0, -1)
    }
    return str
}

appState.on("change:selectedRegion change:selectedSector", function(){
    updateHash()
})
function updateHash(){
    var region =appState.get("selectedRegion")
    var industry =appState.get("selectedSector")

    if (!industry || !region) {
        // close enough i think..., even though the hash then isn't 100% accurate
        return
    }

    industry = getUrlName(industry)
    region = getUrlName(region)

    if (!location.replace) { return }
    location.replace("#" + region + "/" + industry)
}

var labelPositions = {
    "Yorkshire and The Humber": [-1.1475164145546082, 53.880169257397405],
    "East of England": [0.3943214161556234, 52.30157930650532],
    "West Midlands": [-2.296005337711604, 52.42010043668663],
    "East Midlands": [-0.7987427777038331, 53.03152296115058],
    "Northern Ireland": [-6.387374305551321, 54.6312020326397],
    "South East": [-0.20537731500416379, 50.988245863700065],
    "South West": [-3.340470554508402, 50.83294840539262],
    "North West": [-2.893168805722688, 54.3874519215814],
    "North East": [-1.7075420690222852, 54.78145557801282] ,
    "London": [.4187208853255218, 51.699665795665885]  ,
    "Scotland": [-4.1552595096291745, 56.75917735545383],
    "Wales": [-3.7787190954890737, 51.96123618270484]
}


var defaultGray = "#999"

var industryGroups;

function loadGroupNames(callback){
    d3.json("group-names.json", function(data){
        industryGroups = data
        callback();
    })
}




function loadMapData(callback){
    d3.json("uk2-simplified.json", function(error, area) {
        window.mapData = area;
        callback();
    })
}

function updateSizesBasedOnScreen(){
    window.width = 500;
    window.height = 600;

    window.scale = 3600;

    var windowWidth = $(window).width()
    if (windowWidth < 1024 && windowWidth > 600){
        window.width = Math.round(width - (1024 - windowWidth) / 2);
        window.scale = Math.round(window.scale * (windowWidth / 1024)) - 200
        window.height = height * (windowWidth / 1024)
    } else if (windowWidth < 1024 && windowWidth <= 600) {
        window.width = Math.min(400, windowWidth)
        window.height = 220
        window.scale = 1300
    }

    window.projection = d3.geo.albers()
      .center([2, 54.65])
      .rotate([4.4, 0])
      .parallels([50, 60])
      .scale(window.scale)
      .translate([window.width / 2, window.height / 2]);
}


loadMapData(function(){
    initMap()
    checkIfReady();
})
loadEmploymentData(checkIfReady)
loadGroupNames(checkIfReady)

function checkIfReady(){
    if (window.mapData && window.employeeData && window.industryGroups) {
        initMap()

        selectRandomSectors();

        var initialRegion = "London"
        var initialSector = "Activities of head offices; management consultancy activities"
        var hash = _.escape(location.hash).replace("#", "");
        if (hash && hash.indexOf("/") !== -1) {
            var parts = hash.split("/")
            initialRegion = _.find(regions, function(region){
                return getUrlName(region) === parts[0]
            })
            initialSector = _.find(ukSectorsByName, function(sector){
                return getUrlName(sector.sector) === parts[1]
            }).sector
        }

        appState.set("selectedRegion", initialRegion)
        appState.set("selectedSector", initialSector)

        appState.on("change:randomSectors", function(){
            updateDisplayedRegion();
        })
    }
}

function initMap(){
    updateSizesBasedOnScreen();
    $("#map").empty();
    $(".left").width(width)
    window.svg = d3.select("#map").append("svg")
        .attr("width", width)
        .attr("height", height)
    drawMap()
    initRegionLabels();
}

$(window).on("resize", onResize)

var widthOnLastResize = $(window).width()
function onResize(){
    if (widthOnLastResize === $(window).width()) {
        // ignore height only resizes, probalby just means the user scrolled and
        // the mobile top bar disappeared
        return;
    }
    widthOnLastResize = $(window).width()

    initMap()

    if (isMobile){
        appState.set("previewRegion", null)
        appState.set("previewedSector", null)
    }

    updateAfterRegionSelected()
    updateSectorHighlight();
}

var employeeData;
var ukSectorsByName;

function loadEmploymentData(callback) {
    d3.json("employees3.json", function(data){
        var ukData = data["United Kingdom"]
        var regionNames = _.keys(data)
        var regionData = _.values(data)

        regionData.forEach(function(sectors, i){
            var totalEmployees = 0;
            sectors.forEach(function(sector){
                totalEmployees += sector.employees
            })
            sectors.forEach(function(sector){
                sector.percentage = Math.round(sector.employees / totalEmployees * 100 * 10) / 10;
            })
        })



        regionData.forEach(function(sectors){
            sectors.forEach(function(sector){
                var ukSector = _(ukData).find({sic2: sector.sic2})

                var specialness = null;
                // I want to find the most extreme differences across the UK, but
                // naturally that would skew towards small sectors (e.g. .5% vs 2%)
                // rather than large sectors (e.g. 6 vs 10%)
                // so prioritize larger
                var isMeaningFul = (sector.percentage > 1 || ukSector.percentage > 1) && Math.abs(sector.percentage - ukSector.percentage) > .5
                // bigger difference from UK
                var isFarBigger = (sector.percentage / ukSector.percentage) > 2.25 && sector.percentage > 1
                var isFarFarBigger = (sector.percentage / ukSector.percentage) > 4 && sector.percentage > .5

                var isSmallDifference;
                var smallDifferenceThreshold = 1.15 // deemphasize stuff like 9.8 vs 10

                var sign = sector.percentage > ukSector.percentage ? 1 : -1;
                if (sector.percentage > ukSector.percentage) {
                    specialness = sector.percentage / Math.max(ukSector.percentage, .1) * Math.log10(sector.percentage * 10)
                    isSmallDifference = sector.percentage / ukSector.percentage < smallDifferenceThreshold
                } else {
                    specialness = -1 * ukSector.percentage / Math.max(sector.percentage, .1) * Math.log10(ukSector.percentage * 10)
                    isSmallDifference = ukSector.percentage / sector.percentage < smallDifferenceThreshold
                }

                if (isMeaningFul) {
                    specialness *= 1000;
                }
                if (isFarBigger) {
                    specialness *= 1000000
                }
                if (isFarFarBigger) {
                    specialness *= 1000
                }
                if (isSmallDifference) {
                    specialness /= 100000000;
                }


                sector.comparedToUKAveragePercentage = Math.round(sector.percentage / Math.max(ukSector.percentage, .1) * 100 * 10) / 10
                sector.specialness = specialness
            })
        })

        _.each(data, function(sectors, region){
            data[region] = _.sortBy(sectors, "percentage").reverse()
        })

        ukSectorsByName = _.indexBy(data["United Kingdom"], "sector")

        employeeData = data;

        window.regions = _.keys(data).filter(function(r) {
            return r !== "United Kingdom"
        })
        callback()
    })
}

var regionLabels = {}
function initRegionLabels(){

    var labelG = svg.append("g")
    for (region in labelPositions) {
        var coords = labelPositions[region]
        var xy = projection(coords)

        if (region === "London" && isMobile()) {
            xy[1] -= 2;
        }

        var fontSize;
        if ($(window).width() > 900) {
            fontSize = "14px";
        } else {
            fontSize = "10px";
            if ($(window).width() < 600){
                fontSize = "8px";
            }

        }

        var label = labelG.append("text")
            .text("")
            .attr("style", "font-size: " + fontSize + ";pointer-events: none;")
            .attr("font-weight", "bold")
            .attr("fill", "white")
            .attr("transform", "translate(" + (xy[0] - (isMobile() ? 10 : 20)) + "," + xy[1]  + ")")

      regionLabels[region] = label
    }
}

function showSectorOnMap(sector){
    var sectorData = _.mapObject(employeeData, function(region){ return _.find(region, {sector: sector}) })
    var ukSector = _.find(employeeData["United Kingdom"], {sector: sector})
    var values = _.pluck(_.values(sectorData), "percentage")

    var scale = d3.scale.linear()
        .domain([d3.min(values), d3.max(values)])
        .range([defaultGray, "red"])

    _.each(sectorData, function(sector, region){
        var cls = getClassFromRegion(region)
        var el = document.querySelectorAll("." + cls)

        if (el.length === 0) {
            return
        }
        [].slice.call(el).forEach(function(el){
            el.setAttribute("fill", scale(sector.percentage))
        })

        regionLabels[region].text(sector.percentage.toFixed(1) + "%")
    })


}



function displaySectorDetails(sector){
    var sectorObject = ukSectorsByName[sector]
    var groupCodes = _.chain(industryGroups).keys().filter(function(code){
        return code.substr(0, 2) === sectorObject.sic2
    }).value();

    var groupList = "";
    groupList += "Subcategories:"
    groupList = "<ul>"
    groupCodes.forEach(function(code){
        groupList += "<li>"
            groupList += industryGroups[code]
        groupList += "</li>"
    })
    groupList += "</ul>"
    var sectorDetails = ""
    sectorDetails += "<div class='sector-details'>"
        sectorDetails += "<div class='sector-details__show-on-hover'>"
            sectorDetails += "<div style='position: relative'>"
                sectorDetails += "<div class='sector-details-content'>"
                    sectorDetails += groupList
                sectorDetails += "</div>"
            sectorDetails += "</div>"
        sectorDetails += "</div>"
        sectorDetails += "<div>"
            sectorDetails +=  "<span style='font-size: 10px;'>Percentage of Employment in:</span><br/>" + sector + "<span class='i-icon'>i</span>"
        sectorDetails += "</div>"
    sectorDetails += "</div>"
    $("#sector-details").html(sectorDetails)

    $("#sector-details").on("click", function(){
        if (isMobile()) {
            $(".sector-details__show-on-hover").toggle();
        }
    })
}

appState.on("change:previewedSector", function(){
    updateSectorHighlight();
})


appState.on("change:selectedSector", function(){
    var isPortrait = $(window).width() < $(window).height();
    if (isMobile() && isPortrait) {
        $("body").animate({
            scrollTop: 0
        })
    }
    updateSectorHighlight();
})

function updateSectorHighlight(){
    highlightpreviewintable()

    var previewedSector = appState.get("previewedSector")
    var selectedSector = appState.get("selectedSector")

    var sector = selectedSector;
    if (previewedSector) {
        sector = previewedSector
    }

    if (sector){
        showSectorOnMap(sector)
        if (sector === selectedSector) {
            $(".sector-details").css("opacity", "1")
            displaySectorDetails(sector)
        } else {
            $(".sector-details").css("opacity", "0");
        }
    } else {
        regions.forEach(function(region){
            var cls = getClassFromRegion(region)
            var el = document.querySelectorAll("." + cls)
            if (!el.length) {return}
            [].slice.call(el).forEach(function(e){
                e.setAttribute("fill", defaultGray)
            })
        })
    }
}

function getClassFromRegion(region){
    return "region-" + region.replace(/[^a-zA-Z]/g, "").toLowerCase()
}


function drawMap(){
    if (!window.mapData) {
        return;
    }

    function getRegion(d){
        return d.properties.region
    }
    svg.selectAll(".area")
         .data(topojson.feature(window.mapData,  window.mapData.objects.uk).features)
         .enter()
         .append("path")
         .attr("d", d3.geo.path().projection(projection))
         .attr("class", function(d){
             return getClassFromRegion(getRegion(d))
         })
         .attr("fill", defaultGray)
         .on("click", function(d){
             var coords = d3.mouse(this);
             var pos = projection.invert(coords)
             console.log("clicked pos", pos, d)
             appState.toggleSelectedRegion(getRegion(d))
         })
         .on("mouseenter", function(d){
             appState.set("previewRegion", getRegion(d))
         })
         .on("mouseleave", function(d){
             appState.set("previewRegion", null)
         });

    // boundaries don't work well with map data from different files
    // svg.append("path")
    //      .datum(topojson.mesh(window.mapData, window.mapData.objects.uk, function(a, b){
    //         return a !== b
    //      }))
    //      .attr('d', d3.geo.path().projection(projection))
    //      .attr('class', 'boundary');

    FastClick.attach(document.querySelector("#map svg"));
}

var suppressRegionPreview = false;

appState.on("change:selectedRegion", function(){
    updateAfterRegionSelected();
})

function updateAfterRegionSelected(){
    var selectedRegion = appState.get("selectedRegion")
    $(".region--selected").removeClass("region--selected")

    if (selectedRegion) {
        var el = getClassFromRegion(selectedRegion)
        $("." + el).addClass("region--selected")


        $(".region--selected__highlight").removeClass("region--selected__highlight")
        suppressRegionPreview = true
        var previewRegion = appState.get("previewRegion")
        setTimeout(function(){
            suppressRegionPreview = false;
            if (previewRegion !== appState.get("previewRegion")) {
                appState.trigger("change:previewRegion")
            }
        }, 1000)
    }

    updateDisplayedRegion();
}

appState.on("change:previewRegion", function(){
    if (suppressRegionPreview) {
        return;
    }

    var previewRegion = appState.get("previewRegion")
    $(".region--previewed").removeClass("region--previewed")

    if (previewRegion) {
        var el = getClassFromRegion(previewRegion)
        $("." + el).addClass("region--previewed")
    }

    updateDisplayedRegion()
})
var lastSelectionDisplayedOnTable = "London";
function updateDisplayedRegion(){
    if (appState.get("previewRegion")) {
        displayRegionDetails(appState.get("previewRegion"), false)
    }
    else {
        displayRegionDetails(appState.get("selectedRegion"), lastSelectionDisplayedOnTable !== appState.get("selectedRegion"))
        lastSelectionDisplayedOnTable = appState.get("selectedRegion")
    }
}

var lastDisplayedRegion = null;
var lastRandomSectors = null;
function displayRegionDetails(region, animate){
    if (region === lastDisplayedRegion && appState.get("randomSectors") === lastRandomSectors) {return}
    lastDisplayedRegion = region
    lastRandomSectors = appState.get("randomSectors")

    $(".select2-container").remove();

    var detailsEl = document.getElementById("table");
    if (!region) {
        detailsEl.innerHTML = ""
        $(".sources").hide();
        $(".i-icon").hide(); // this kinda is screenshot mode...
        return;
    }
    $(".i-icon").show();

    $(".sources").show();



     var html = "";
     html += "<div style='overflow: hidden;' class='region-title'>"
         html += "<select class='region-dropdown needsclick'>"
             regions.sort().forEach(function(r){
                 html += "<option " + (r==region ? "selected" :"") + ">" + r + "</option>"
             })
         html += "</select>"
     html += "</div>"
     html += "</div>"

     var e = employeeData[region]
     e = _.sortBy(e, "specialness")
     var ukData = employeeData["United Kingdom"]

     var regionColumnHeader = region;
     var shortNames = {
         "Yorkshire and The Humber": "Y&H",
         "East of England": "EE",
         "West Midlands": "WM",
         "East Midlands": "EM",
         "Northern Ireland": "NI",
         "South East": "SE",
         "South West": "SW",
         "North West": "NW",
         "North East": "NE",
         "London": "LDN",
         "Scotland": "SCO",
         "Wales": "WAL"
     }
     if (region in shortNames) {
         regionColumnHeader = shortNames[region]
     }


     html += "<table class='sector-table'>"
     html += "<tr>"
        html += "<th style='text-align: left'>Larger Than Average Industries</th>"
        html += "<th class='sector-table__percentage'>" + regionColumnHeader + "</th>"
        html += "<th class='sector-table__percentage'>" + "UK" + "</th>"
     html += "</tr>"
     var most = e.filter(function(sector){
         return sector.specialness > 0;
     })

     most = _.sortBy(most, "specialness").reverse()
     most = most.slice(0, 6)
     most = _.sortBy(most, "percentage").reverse()
     most.push("Smaller Than Average")

     var least = e.filter(function(sector){
         return sector.specialness < 0;
     })
     least = _.sortBy(least, "specialness")
     least = least.slice(0, 3)
     least = _.sortBy(least, "percentage").reverse();

     least.push("Largest Industries")
     var largest = e.slice()
     largest = _.sortBy(largest, "percentage").reverse()
     largest = largest.slice(0, 3)

     largest.push("Random Industries")
     var randomSectorNames = appState.get("randomSectors")
     var random = [];
     random.push(_(e).find({sector: randomSectorNames[0]}))
     random.push(_(e).find({sector: randomSectorNames[1]}))

     most.concat(least).concat(largest).concat(random).forEach(function(ee){
         if (typeof ee === "string") {
             var title = ee;
             var randomUI = ""
             if (ee === "Random Industries") {
                randomUI = "<span class='refresh-random'>Click to refresh</button>"
             }
             html += "<tr " + (ee === "Random Industries" ? " onClick='selectRandomSectors()' ": "") + " data-title='" + title + "'>"
                html += "<th style='text-align: left' colspan='3'>" + title + randomUI + "</th>"
             html += "</tr>"
             return
         }
        var ukSector = _(ukData).find({sector: ee.sector})

        function employmentValue(employment){
            if (employment < 1000000) {
                return Math.round(employment / 1000) + "k"
            }
            else {
                return (Math.round(employment / 1000 / 1000 * 10) / 10) + "M"
            }

        }

        var isSelected = ee.sector ===  appState.get("selectedSector")
        html += "<tr data-sector='" + ee.sector + "' class='" + (isSelected ? "sector-table__selected-sector" : "") + "'>"
            html += "<td>" + getUISectorName(ee.sector) + "</td>"
            html += "<td class='sector-table__percentage'>" + ee.percentage.toFixed(1) + "%" + "</td>"
            html += "<td class='sector-table__employment'>" + employmentValue(ee.employees) +  "</td>"
            html += "<td class='sector-table__percentage'>" + ukSector.percentage.toFixed(1) + "%</td>"
            html += "<td class='sector-table__employment'>" + employmentValue(ukSector.employees) + "</td>"
        html += "</tr>"
    })
    html += "</table>"


    detailsEl.innerHTML = html;
    if (animate) {
        $(detailsEl).css("opacity", .5)
        $(detailsEl).animate({opacity: 1}, 800)
    }

    $(".region-dropdown").select2({
        formatResult: function(result, container, query, escapeMarkup) {
			container.addClass('needsclick');
			return result.text;
		}
    });
    $(".select2").addClass("needsclick")
    $(".select2-container").css({
        "padding-bottom": "15px",
        "padding-top": "20px",
    })
    $(".region-dropdown").on("select2:open", function(){
        $(".select2-container .select2-results li").each(function(){
            FastClick.attach(this)
        })

    })
    $(".region-dropdown").on("change", function(e){

        appState.set("selectedRegion", $(e.target).val())
    })

    FastClick.attach(document.querySelector("#table table"));

    highlightpreviewintable()
}

function selectRandomSectors(){
    function r(){
        return _.sample(_.keys(ukSectorsByName))
    }
    var random = [r(), r()]

    if (random[0] === random[1]) {
        selectRandomSectors()
        return;
    }

    appState.set("randomSectors", random)
}



function highlightpreviewintable(){
    $("tr[data-sector]").each(function(){
        var elSector = $(this).data("sector")
        if (!elSector) {
            return;
        }

        var previewedSector = appState.get("previewedSector")
        var selectedSector =  appState.get("selectedSector")

        $(this).toggleClass("sector-table__previewed-sector", previewedSector === elSector)
        $(this).toggleClass("sector-table__selected-sector", selectedSector === elSector)
    })
}

// http://stackoverflow.com/questions/21741841/detecting-ios-android-operating-system
function getMobileOperatingSystem() {
  var userAgent = navigator.userAgent || navigator.vendor || window.opera;

      // Windows Phone must come first because its UA also contains "Android"
    if (/windows phone/i.test(userAgent)) {
        return "Windows Phone";
    }

    if (/android/i.test(userAgent)) {
        return "Android";
    }

    // iOS detection from: http://stackoverflow.com/a/9039885/177710
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        return "iOS";
    }

    return "unknown";
}

function isMobile(){
    var os = getMobileOperatingSystem();
    return os === "Windows Phone" || os === "Android" || os === "iOS"
}

function getUISectorName(sector){
    var nameReplacements = {
        "Mining support service activities": "Mining support service activities", // don't change this one
        "Motion picture, video and television programme production, sound recording and music publishing activities": "Film, TV, Music",
        "Wholesale and retail trade and repair of motor vehicles and motorcycles": "Trade and repair of motor vehicles",
        "Crop and animal production; hunting and related service activities": "Crop and animal production; hunting",
        "Architectural and engineering activities; technical testing and analysis": "Architecture, engineering, Technical testing",
        "Activities of head offices; management consultancy": "Head office activities; management consultancy",
        "Manufacture of basic pharmaceutical products and pharmaceutical preparations": "Manufacture of pharmaceuticals",
        "Public administration and defence; compulsory social security": "Public administration and defence; social security"
    }
    if (sector in nameReplacements) {
        return nameReplacements[sector]
    }


    sector = sector.replace("motor vehicles and motorcycles", "motor vehicles")
    sector = sector.replace("machinery and equipment", "machinery")
    sector = sector.replace("trailers and semi-trailers", "trailers")
    sector = sector.replace("fabricated metal products", "metal products")
    sector =  sector.replace(/ activities/g, "")

    if (sector.length > 56) {
        sector = sector.substring(0, 53) + "…"
    }

    return sector
}


$("body").on("mouseenter", ".sector-table td", function(){
    if (isMobile()) {return}
    var sector = $(this).parent().data("sector")
    if (!sector) {return}
    appState.set("previewedSector", sector)
})
$("body").on("mouseleave", ".sector-table td", function(){
    if (isMobile()) {return}
    appState.set("previewedSector", null)
})
$("body").on("click", ".sector-table td", function(){
    var sector = $(this).parent().data("sector")
    if (!sector) {return}
    appState.set("selectedSector", sector)
})

$("#btn-toggle-show-data-details").on("click", function(){
    $(".data-details").show()
    $("#btn-toggle-show-data-details").hide()
})
