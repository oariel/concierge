
var path = require("path");
var request = require('then-request');
var logger = require(path.resolve(__dirname, './logger.js'));
var util = require(path.resolve(__dirname, './util.js'));

function spaceIQQuery(graphQL, cb) {

    // API Key
    var apiKey = "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImRldmVsb3BlckBzcGFjZWlxLmNvbSIsIm5hbWUiOiJEZXZlbG9wZXIgVXNlciIsInJvbGUiOiJhZG1pbiIsImNvbXBhbnlfaWQiOiIyMzc5OGU0NS02ZDAyLTRkZTktYTkwNS03NWMzZjZiOTljYWIiLCJpc19zdXBlcl91c2VyIjpmYWxzZSwiY3JlYXRlZF90aW1lIjoxNTU2MjMxNzkyMDAwLCJleHBfbWluIjotMX0.9dPuuPNSNVAvDyzm77wpZJ141xaqBMDaqZuzLwSjvaM";

    var options = {
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey,
        },
        body: JSON.stringify(graphQL)
    };

    var url = 'https://api.spaceiq.com/queries';
    request('POST', url, options)
        .done(function (res) {
            try {
                str = res.getBody('utf8');
                data = JSON.parse(str);
                return cb(null, data);
            }
            catch (err) {
                logger.e("SpaceIQ query failed: " + err);
                return cb(err, null);
            }
        });

}

module.exports.spaceIQQuery = spaceIQQuery;

