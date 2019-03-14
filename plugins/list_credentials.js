//  Plugin to receive an input
var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var creds = require(path.resolve(__dirname, '../lib/credentials_mdb.js'));

var list_credentials = {
    'names': ['list_credentials'],
    'fn': function(args, cb) {

        try {
          logger.d('Plugin: list_credentials');
          creds.find(args.user_email, null, function(ret) {
            if (!ret) {
              args.bld.text("You have not defined any login credentials. Say ").bold("'New Login'").text(" to get started.").linebreak();
              return cb('err', args);
            }
            for ( var i=0; i<ret.length; i++)
                args.step_result.push( {name: ret[i].label, value: ret[i].label} );
            args.step_result.push( {name: "Cancel", value: "Cancel"} );
            if ( args.data.hasOwnProperty("message") )
                args.bld.text(args.data.message);
            else
                args.bld.text("Select from the following saved login credentials. If the credentials for this command are not yet defined, click 'Cancel' and say ").bold("'New Login'").text(" to define a new pair or say ").bold("Delete Login").text(" to delete an existing one.").linebreak();
            return cb(null, args);
          });
        }
        catch (err) {
          logger.e(err.message);
          args.bld.text(err.message).linebreak();
          return cb(err, args);
        }
    },
};

module.exports = list_credentials;
