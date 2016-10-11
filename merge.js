// Generate UK JSON before running this script
// topojson -o uk.json -- scotland.json wales.json england.json northern-ireland.json
var fs = require("fs")

var data = JSON.parse(fs.readFileSync("uk.json"))

// dunno why the original properties disappear in the merge..
// probably because I don't pass the -p option!!!
var idMapping = {
    "E15000001": "North East",
    "E15000002": "North West",
    "E15000003": "Yorkshire and The Humber",
    "E15000004": "East Midlands",
    "E15000005": "West Midlands",
    "E15000006": "East of England",
    "E15000007": "London",
    "E15000008": "South East",
    "E15000009": "South West",
    "S15000001": "Scotland",
    "W08000001": "Wales",
    "N06000013": "Northern Ireland"
}

var merged = data.objects.eer.geometries
    .concat(data.objects.collection.geometries)
    .concat(data.objects.wales.geometries)
    .concat(data.objects.scotland.geometries)

merged.forEach(function(geometry){
    geometry.properties = {
        region: idMapping[geometry.id]
    }
    if (!geometry.properties.region) {
        console.log(geometry.id)
    }
})

merged = {
    type: "GeometryCollection",
    geometries: merged
}

delete data.objects.eer;
delete data.objects.collection
delete data.objects.wales;
delete data.objects.scotland;

data.objects.uk = merged

fs.writeFileSync("uk2.json", JSON.stringify(data))

// then:
//  topojson -p -o  uk2-simplified.json --simplify-proportion .10 -- uk2.json
