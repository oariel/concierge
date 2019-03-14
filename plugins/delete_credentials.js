//  Plugin to receive an input
var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var creds = require(path.resolve(__dirname, '../lib/credentials_mdb.js'));

var delete_credentials = {
    'names': ['delete_credentials'],
    'fn': function(args, cb) {

        try {
          logger.d('Plugin: delete_credentials');
          var label = args.user_params;
          if (!label) {
            args.bld.text("Label for credentials not provided.").linebreak();
            return cb('err', args);
          }
          creds.delete(args.user_email, label, function(err) {
            if (!err) {
              args.bld.text("Credentials '" + label + "' successfully deleted.").linebreak();
              return cb(null, args);
            }
            else {
              args.bld.text("Failed to delete credentials '" + label + "'").linebreak();
              return cb('err', args);
            }
          });
        }
        catch (err) {
          logger.e(err.message);
          args.bld.text(err.message).linebreak();
          return cb(err, args);
        }
    },
};

module.exports = delete_credentials;
