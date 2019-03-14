var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));

// SFDC login
const strSFUsername  = "mayank.mehta@capriza.com";
const strSFPassword  = "Capriza1!";

var jsforce = require('jsforce');

var connOptions = {
    maxRequest: 50
}

function assignVariable(args, key) {
  for (var i = 0; i<args.variables.length; i++) {
      var str = JSON.stringify(key);
      if ( str.indexOf(args.variables[i].name) >= 0 )
          return JSON.parse( str.replace(args.variables[i].name, args.variables[i].value) );
  }
  return null;
}

function doSyncUpdate(conn, objectClause, findClause, updateClause) {
  return new Promise(resolve => {
    conn.sobject(objectClause).find(findClause).update(updateClause, function(err, res) {
          if ( err ) {
              logger.e(err);
              resolve(null);
          }
          return resolve(res);
      });
  });    
}

var sfupdate = {
    'names': ['sfupdate', 'update', 'sf', 'salesforce', ],
    'fn': function(args, cb) {

        try {

          logger.d('Plugin: sfupdate');

          args.busy();

          // Connect to SFDC
          var conn = new jsforce.Connection(connOptions);
          conn.login(strSFUsername, strSFPassword, async function(err, res) {

              if (err) { args.bld.text("Connection to salesforce.com failed").linebreak(); return cb(err, args);  }

              var objectClause = args.data.object;
              var findClause = assignVariable(args, args.data.find);
              var updateClause = assignVariable(args, args.data.update);
              try {
                var res = await doSyncUpdate(conn, objectClause, findClause, updateClause);
              }
              catch (err) {
                logger.e(err.message);
                return args.cb(null, args.bld.text(err.message));
              }
              args.bld.text(res.length + " record(s) updated.");

              return cb(null, args);

          });
        }
        catch (err) {
          logger.e(err);
          args.bld.text(err.message).linebreak();
          return cb(err, args);
        }
    },
};

module.exports = sfupdate;
