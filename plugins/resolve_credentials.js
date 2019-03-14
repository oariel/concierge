//  Plugin to receive an input
var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var creds = require(path.resolve(__dirname, '../lib/credentials_mdb.js'));
var aes256 = require('nodejs-aes256');

const AES_256_KEY = "Capriza2017!";

var resolve_credentials = {
    'names': ['resolve_credentials'],
    'fn': function(args, cb) {

        try {
          logger.d('Plugin: resolve_credentials');
          var label = args.user_params;
          if (!label) {
            args.bld.text("Label for credentials not provided.").linebreak();
            return cb('err', args);
          }
          creds.find(args.user_email, label, function(ret) {
            if (!ret) {
              args.bld.text("No such credentials.").linebreak();
              return cb('err', args);
            }

            // Set the username and password variables
            args.variables.push({name: "@Username", value: ret[0].username});
            args.variables.push({name: "@Password", value: aes256.decrypt(AES_256_KEY, ret[0].password)});

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

module.exports = resolve_credentials;
