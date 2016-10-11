# UK Employment Map

[Try it online.](http://www.mattzeunert.com/uk-employment/#london/activities-of-head-offices-management)

Run a local server (e.g. with `python -m SimpleHTTPServer`)  and open index.html.

## Project Overview

- **index.js** Contains all custom UI
- **2010-data.js** Uses old data - needed for Northern Ireland and group-names.js
- **2015-data.js** Read 2015 data and generates JSON
- **merge.js** Node script that merges geometries from different TopoJSON files

All CSS is in the index.html file.

## Sources / Licenses

[2015 data for Great Britain from Nomis Employment Survey](http://www.nomisweb.co.uk/)  
[2010 data spreadsheet](http://www.ons.gov.uk/ons/rel/bus-register/business-register-employment-survey/2010-revised/rfttable5.xls)

UK map taken from Martin Chorley's UK-GeoJSON project.  
Contains Ordnance Survey, Office of National Statistics, National Records Scotland and LPS Intellectual Property data © Crown copyright and database right [2016]. Data licensed under the terms of the Open Government Licence (http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3). Ordnance Survey data covered by OS OpenData Licence. Any further sub-licences must retain this attribution.
