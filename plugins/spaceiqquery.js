// Plugin to receive an input
var path = require("path");
var request = require('then-request');
var jsonexport = require('jsonexport');
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var util = require(path.resolve(__dirname, '../lib/util.js'));

// SpaveIQ configuration
var spaceiq = require("../lib/spaceiq.js");

function findIntersection(a, b) {

    function findIntersectionFromStart(a, b) {
        for (var i = a.length; i > 0; i--) {
            d = a.substring(0, i);
            j = b.indexOf(d);
            if (j >= 0) {
                return ({ position: j, length: i });
            }
        }
        return null;
    }

    var bestResult = null;
    for (var i = 0; i < a.length - 1; i++) {
        var result = findIntersectionFromStart(a.substring(i), b);
        if (result) {
            if (!bestResult) {
                bestResult = result;
            } else {
                if (result.length > bestResult.length) {
                    bestResult = result;
                }
            }
        }
        if (bestResult && bestResult.length >= a.length - i)
            break;
    }
    return bestResult;
}


var spaceiqquery = {
    'names': ['spaceiqquery'],
    'fn': function (args, cb) {

        try {
            logger.d('Plugin: spaceiqquery');

            if ( !args.data.hasOwnProperty("query") ) {
                args.bld.text("Configuration error: query not provided.").linebreak();
                return cb('err', args);
            }

            var literal = args.user_params;
            var stepResult = [];

            args.busy();

            // Is it a followup?
            var query = args.data.query.replace('{0}', literal);

            // Create query object
            var graphQL = {
                "query": util.parameterize_string(query, args.variables)
            }

            if ( args.data.hasOwnProperty("input") ) {
                var input = util.parameterize_object(args.data.input, [ {name: "{0}", value: literal} ]);
                graphQL.variables = {
                    "input": util.parameterize_object(input, args.variables)
                }
            }


            //logger.print_object(graphQL);

            ret = spaceiq.spaceIQQuery(graphQL, function (err, ret) {
                if (err) {
                    args.bld.text("SpaceIQ query error").linebreak();
                    return cb('err', args);
                }

                // Execution error occurred
                if ( ret.hasOwnProperty("errors") ) {
                    args.bld.bold(ret.errors[0].message).linebreak();
                    return cb('err', args);
                }

                // Format output
                var options = {
                    mapHeaders: (header) => header.replace(/\"/gi, ''),
                    rowDelimiter: '<SEP>',
                    forceTextDelimiter: false,
                    includeHeaders: true,
                    endOfLine: '<EOL>',
                    verticalOutput: true,
                    typeHandlers: {
                        String: function (value, index, parent) {
                            var step_result = args.data.step_result;
                            if ( step_result && step_result.name && parent.hasOwnProperty(step_result.name) && step_result.value && parent.hasOwnProperty(step_result.value) ) {
                                var found = stepResult.find( element => {
                                    return element.name === parent[step_result.name] && element.value === parent[step_result.value ];
                                });
                                if ( !found )
                                    stepResult.push( {name: parent[step_result.name], value: parent[step_result.value ]} );

                                // Include in the result?
                                if ( step_result.hasOwnProperty("include") && step_result.include )
                                    return value;
                            }
                            else
                                return value;
                        }
                    }
                }

                jsonexport(ret, options, function (err, result) {

                    if (!result) {
                        args.bld.text("Sorry. Can't find any matches.").linebreak();
                        return cb('err', args);
                    }


                    var firstItem = '';
                    var rows = result.split('<EOL>');

                    // find the root by intersecting all strings
                    var root = rows[0].split('<SEP>')[0];
                    for (var i = 1; i < rows.length; i++) {
                        var str = rows[i].split('<SEP>')[0];
                        var result = findIntersection(root, str);
                        if (result) {
                            root = str.substring(result.position, result.position + result.length);
                        }
                    }

                    for (var i = 0; i < rows.length; i++) {

                        var items = rows[i].split('<SEP>');
                        var name = items[0].split(root)[1];

                        // empty value
                        if ( !items[1] )
                            continue;

                        // Seperate blocks of identical results
                        if (i == 0)
                            firstItem = name;
                        else {
                            if (name === firstItem)
                                args.bld.linebreak();
                        }

                        var label = '';
                        var parts = name.split(".");
                        for (var j = 0; j < parts.length; j++) {
                            label += util.camel_case_to_title_case(parts[j]);
                            if (j < parts.length - 1)
                                label += "/";
                        }

                        // no label - use literal
                        if ( !label )
                            label = literal;
                        args.bld.ident().bold(label).text(": ");

                        // Hyperlink
                        if (items[1].indexOf("http://") != -1 || items[1].indexOf("https://") != -1)
                            args.bld.link("View", items[1]);
                        else
                            args.bld.text(items[1]);

                        args.bld.linebreak();
                    }

                    //logger.print_object(stepResult);

                    // add to step result
                    args.step_result = stepResult;

                    args.idle();
                    return cb(null, args);
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

module.exports = spaceiqquery;
