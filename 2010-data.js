var fs = require('fs');
var csv = require("fast-csv")
var _ = require("underscore")
var async = require("async")

readCSV("data/Division Names-Table 1.csv", function(sheet){
    var divisions = {}
    sheet.slice(1).forEach(function(row){
        divisions[row[0]] = row[1]
    })

    readData(divisions);
})

var regions = [
    "Yorkshire and The Humber",
    "East of England",
    "West Midlands",
    "East Midlands",
    "Northern Ireland",
    "South East",
    "South West",
    "North West",
    "North East",
    "London",
    "Scotland",
    "Wales"
]
function readData(divisions) {
    var employmentData = {};

    async.each(regions, function(region, callback){
        readCSV("data/" + region + "-Table 1.csv", function(sheet){
            const FIRST_ROW_INDEX = 5;
            const LAST_ROW_INDEX = 352;
            const TOTAL_WORKERS_COLUMN_INDEX = 13;

            var rows = sheet.slice(FIRST_ROW_INDEX, LAST_ROW_INDEX + 1)
            rows = rows.filter(function(row){
                return row[0] !== "";
            })

            rows = rows.map(function(row){
                var sic2 = row[0].toString().replace("*","");
                var cell = row[TOTAL_WORKERS_COLUMN_INDEX].trim();
                var employees = 0;
                if (cell === "-" || cell === "*") {
                    employees = 0;
                }
                else {
                    employees = parseFloat(cell) * 1000
                }
                if (isNaN(employees)) {
                    console.log(row[TOTAL_WORKERS_COLUMN_INDEX])
                }
                return {
                    sic2: sic2,
                    sector: divisions[sic2],
                    employees: employees
                }
            })

            employmentData[region] = rows

            callback();
        })

    }, function() {
        var ukData = [];
        for (var sic2 in divisions) {
            var division = divisions[sic2]
            var regionEmployees = _.mapObject(employmentData, function(region){
                return _(region).find({sector: division}).employees;
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

        fs.writeFileSync("employees2.json", JSON.stringify(employmentData, null, 2))
    })
}

readCSV("data/Group Names-Table 1.csv", function(sheet){
    var rows = sheet.slice(1)
    var codes = {};
    rows.forEach(function(row){
        codes[row[0]] = row[1]
    })
    fs.writeFileSync("group-names.json", JSON.stringify(codes, null, 2))
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
