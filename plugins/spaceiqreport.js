// Plugin to receive an input
var path = require("path");
var request = require('then-request');
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var util = require(path.resolve(__dirname, '../lib/util.js'));

// SpaveIQ configuration
var spaceiq = require("../lib/spaceiq.js");

var spaceiqreport = {
    'names': ['spaceiqreport'],
    'fn': function (args, cb) {

        try {
            logger.d('Plugin: spaceiqreport');

            var reportName = args.data.report_name;

            args.busy();

            // Query exists?
            if (!reportName) {
                args.bld.text("Report name not defined").linebreak();;
                return cb('err', args);
            }

            // Create query object
            query = {
                "query": "query { viewer { company { report(name: \"" + reportName + "\") { name description category categoryName csvUrl } } } }"
            }

            ret = spaceiq.spaceIQQuery(query, function (err, ret) {
                if (err) {
                    args.bld.text("SpaceIQ query error").linebreak();
                    return cb('err', args);
                }

                // Get CSV report
                var csvUrl = ret.data.viewer.company.report.csvUrl;
                args.bld.bold(ret.data.viewer.company.report.name).linebreak().text(ret.data.viewer.company.report.description).linebreak();
                
                request('GET', csvUrl)
                    .done(function (res) {
                        try {
                            csv = res.getBody('utf8');

                            // generate result
                            var lines = csv.split("\n"); // note that the last line is always empty
                            if ( lines.length == 2 ) {
                                args.bld.text("No data found").linebreak();
                                return cb('err', args);   
                            }

                            var headers = lines[1].split(",");
                            for ( var i=1; i<lines.length-1; i++ ) {
                                var values = lines[i].split(",");
                                for ( j=0; j<headers.length; j++ )
                                    args.bld.ident().bold(headers[j].replace(/\"/g, '')).text(": ").text(values[j].replace(/\"/g, '')).linebreak();
                                if ( i<lines.length-1 )
                                    args.bld.linebreak();
                            }

                            args.idle();
                            return cb(null, args);
                        }
                        catch (err) {
                            logger.e("Error fetchiing CSV report " + csvUrl + ": " + err.message);
                            args.bld.text("Error fetching report CSV: " + err.message).linebreak();
                            return cb('err', args);
                        }
                    });

            });

        }
        catch (err) {
            logger.e(err.message);
            args.cb(null, err.message);
            return cb(err, args);
        }
    },
};

module.exports = spaceiqreport;
