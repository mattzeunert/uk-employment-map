var fs = require('fs');
var csv = require("fast-csv")
var _ = require("underscore")
var async = require("async")


var regions = [
    "Yorkshire and The Humber",
    "East",
    "West Midlands",
    "East Midlands",
    // "Northern Ireland",
    "South East",
    "South West",
    "North West",
    "North East",
    "London",
    "Scotland",
    "Wales"
]



readCSV("data3/nomis_2016_09_30_173109.csv", function(sheet){
    var dataRows = [];
    var headerRow = sheet[7]
    var rows = sheet.slice(9, -1)

    var employmentData = {}

    regions.forEach(function(region){
        var colIndex = headerRow.indexOf(region);
        console.log(region, colIndex)
        var regionData = []

        rows.forEach(function(row){
            var info = row[0].split(":")
            var sic = info[0].trim();
            var sector = info[1].trim()
            var value = row[colIndex];

            regionData.push({
                sector: sector,
                sic2: sic,
                employees: parseFloat(value.replace(",", ""))
            })
        })
        console.log(regionData)

        if (region === "East") {
            region = "East of England"
        }
        employmentData[region] = regionData
    })

    var divisions = {};

    employmentData.London.forEach(function(s){
        console.log("aa")
        divisions[s.sic2] = s.sector
    })

    regions.push("Northern Ireland")
    var data2010 = JSON.parse(fs.readFileSync("./employees2.json"))
    var niData = data2010["Northern Ireland"]
    niData.forEach(function(sector){
        if (sector.sector !== divisions[sector.sic2]) {
            console.log(sector.sic2, divisions[sector.sic2])
        }
        sector.sector = divisions[sector.sic2] // division names changed slightly
    })
    niData = niData.concat([
        {
          "sic2": "97",
          "sector": "Activities of households as employers of domestic personnel",
          "employees": 0
        },
        {
          "sic2": "98",
          "sector": "Undifferentiated goods- and services-producing activities of private households for own use",
          "employees": 0
        },
        {
          "sic2": "99",
          "sector": "Activities of extraterritorial organisations and bodies",
          "employees": 0
        }
    ])
    employmentData["Northern Ireland"] =  niData


    var ukData = [];
    for (var sic2 in divisions) {
        var division = divisions[sic2]
        var regionEmployees = _.mapObject(employmentData, function(region){
            return _(region).find({sic2: sic2}).employees;
        })
        regionEmployees = _.values(regionEmployees)
        var employees = sum(regionEmployees);

        ukData.push({
            sic2: sic2,
            sector: division,
            employees: employees
        })
    }

    employmentData["United Kingdom"] = ukData

    fs.writeFileSync("employees3.json", JSON.stringify(employmentData, null, 2))


})



function readCSV(file, callback){
    var stream = fs.createReadStream(file);

    var sheet = []
    var csvStream = csv()
        .on("data", function(row){
             sheet.push(row)
        })
        .on("end", function(){
            callback(sheet)
        });

    stream.pipe(csvStream)
}

function sum(arr){
    var ret = 0;
    arr.forEach(function(val){
        ret += val
    })
    return ret;
}
