var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var util = require(path.resolve(__dirname, '../lib/util.js'));

// SFDC login
const strSFUsername  = "mayank.mehta@capriza.com";
const strSFPassword  = "Capriza1!";

var jsforce = require('jsforce');

var connOptions = {
    maxRequest: 50
}

// Strip off HTML from database text
function stripHtml(bld, inStr) {
  var str = inStr;

  // Remove all HTML references
  str=str.replace(/<br>/gi, "%N%");
  str=str.replace(/<p.*>/gi, "%N%");
  str=str.replace(/<a.*href="(.*?)".*>(.*?)<\/a>/gi, " $2 (Link->$1) ");
  str=str.replace(/<(?:.|\s)*?>/g, "");
  str=str.replace(/&#39;/g,"'");
  str=str.replace(/&amp;/g,"&");

  // Reformat back to output
  while (str.length > 0) {
      var index = str.search(/%N%/gi);
      if ( index != -1 ) {
          bld.text(str.substr(0, index) ).linebreak().ident();
          str = str.substr(index + 3);
      }
      else {
        bld.text(str);
        break;
      }
  }
}

function isObject(val) {
    return val instanceof Object;
}

function doSyncQuery(conn, query) {
    return new Promise(resolve => {
        conn.query(query).run({ autoFetch : true, maxFetch : 25 }, function(err, res) {
            if ( err ) {
                logger.e(err);
                resolve(null);
            }
            return resolve(res);
        });
    });    
}

var sfquery = {
    'names': ['sfquery', 'query', 'sf', 'salesforce', ],
    'fn': function(args, cb) {

          var lookupMode = false;
          var stepResult = [];
          var literal = args.user_params;

          // Connect to SFDC
          var conn = new jsforce.Connection(connOptions);
          conn.login(strSFUsername, strSFPassword, async function(err, res) {

              if (err) { args.bld.text("Connection to salesforce.com failed").linebreak(); return cb(err, args);  }

            args.busy();

            // Escape charecters
            literal = literal.replace("\\", "\\\\");
            literal = literal.replace('""', '\\"');
            literal = literal.replace("'", "\\'");

            // Is it a followup?
            var query = args.data.query.replace('{0}', literal);

            // Override of column names (due to non aliasing in SF SOQL)
            var columnNames = {};
            if ( args.data.hasOwnProperty('column_names') )
                columnNames = args.data.column_names;

            // No output - this query is used to retrieve a list of items to select
            if ( args.data.hasOwnProperty('lookup_mode') )
                lookupMode = args.data.hasOwnProperty('lookup_mode');

            // Parameterize the string
            query = util.parameterize_string(query, args.variables);
            //logger.log(query);

            // Query exists?
            if ( query.length == 0 ) {
            args.bld.text("Query not defined").linebreak();;
            return cb('err', args);
            }

            // Run query
            try {
                res = await doSyncQuery(conn, query);
                if ( res.totalSize == 0 ) {
                    args.bld.text("Sorry, No results found for '" + literal + "'").linebreak();
                    return cb('err', args);
                }
            }
            catch (err) {
                logger.e(err.message);
                args.bld.text(err.message).linebreak();
                return cb(err, args);
            }

            var maxRows  = 9999;
            if ( args.data.max_rows != null )
                maxRows = parseInt(args.data.max_rows);

            var nRows = Math.min(maxRows, res.totalSize);

            // Build output string
            for ( var i=0; i<nRows; i++ ) {
                var obj = new Object(res.records[i]);

                if ( !lookupMode && nRows > 1 )
                args.bld.text("Row ").bold((i+1).toString()).linebreak();

                //logger.print_object(obj);

                for (var propertyName in obj ) {

                    // A related object
                    if ( propertyName != 'attributes' && typeof obj[propertyName] == 'object' ) {
                        var child = obj[propertyName];
                        for (var chPropertyName in child ) {
                        var str = child[chPropertyName] == null ? "" : child[chPropertyName].toString();
                        if ( chPropertyName != 'attributes' && str.length > 0 ) {

                            var comp = chPropertyName.toString();
                            var name = columnNames[propertyName + "." + chPropertyName]; // use specified column name
                            if ( !name ) name = chPropertyName.replace('__c', '').replace(/_/g, ' ');

                            if ( !lookupMode && name != '-' ) {
                                args.bld.ident().bold(name).text(": ");
                                stripHtml(args.bld, str);
                                args.bld.linebreak();
                            }

                            // Push to result column
                            if ( args.data.hasOwnProperty('result_column') && args.data.result_column == (propertyName + "." + chPropertyName) ) {
                                stepResult.push( {value: str, name: str} );
                            }

                            // Save to variable
                            if ( args.data.hasOwnProperty('store') && args.data.store[propertyName + "." + chPropertyName] ) {
                                var varName = args.data.store[propertyName + "." + chPropertyName];
                                var found = false;

                                for ( var i=0; i<args.variables.length; i++ ) {
                                    if ( args.variables[i].name == varName ) {
                                        args.variables[i].value = str;
                                        found = true;
                                    }
                                }
                                if ( !found )
                                    args.variables.push( {name: val, value: str} );
                            }
                        }
                        }
                    }
                    else {
                        var str = obj[propertyName] == null ? "" : obj[propertyName].toString();
                        if ( propertyName != 'attributes' && str.length > 0 ) {

                            var comp = propertyName.toString();
                            var name = columnNames[propertyName]; // use specified column name
                            if ( !name ) name = propertyName.replace('__c', '').replace(/_/g, ' ');

                            if ( !lookupMode && name != '-' ) {
                            args.bld.ident().bold(name).text(": ");
                            stripHtml(args.bld, str);
                            args.bld.linebreak();
                            }

                            // Push to result column
                            if ( args.data.hasOwnProperty('result_column') && args.data.result_column == propertyName ) {
                                stepResult.push( {name: str, value: str} );
                            }

                            // Save to variable
                            if ( args.data.hasOwnProperty('store') && args.data.store[propertyName] ) {
                                var varName = args.data.store[propertyName];
                                var found = false;
                                for ( var i=0; i<args.variables.length; i++ ) {
                                    if ( args.variables[i].name == varName ) {
                                    args.variables[i].value = str;
                                    found = true;
                                    }
                                }
                                if ( !found )
                                args.variables.push( {name: val, value: str} );
                            }
                        }

                    }
                }
                if ( !lookupMode ) args.bld.linebreak();
            }

            args.step_result = stepResult;

            args.idle();

            return cb(null, args);

          });
    },
};

module.exports = sfquery;
