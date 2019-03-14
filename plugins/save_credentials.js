//  Plugin to receive an input
var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var creds = require(path.resolve(__dirname, '../lib/credentials_mdb.js'));
var aes256 = require('nodejs-aes256');

const AES_256_KEY = "Capriza2017!";

function getVariable(variables, name) {
  for (var i = 0; i<variables.length; i++) {
      if ( name.indexOf(variables[i].name) >= 0 )
         return variables[i].value;
  }
  return null;
}

var save_credentials = {
    'names': ['save_credentials'],
    'fn': function(args, cb) {

        try {
          logger.d('Plugin: save_credentials');

          // We're expecting three variables: @Label, @Username, @Password
          var label = getVariable(args.variables, "@Label");
          if ( !label) {
            args.bld.text("Label is not defined").linebreak();
            return cb('err', args);
          }

          var username = getVariable(args.variables, "@Username");
          if ( !username) {
            args.bld.text("Username is not defined").linebreak();
            return cb('err', args);
          }

          var password = getVariable(args.variables, "@Password");
          if ( !password) {
            args.bld.text("Password is not defined").linebreak();
            return cb('err', args);
          }

          // Save credentials
          creds.add({
              email: args.user_email,
              label: label,
              username: username,
              password: aes256.encrypt(AES_256_KEY, password)
          }, function(err) {
              if (err) {
                args.bld.text("Can't store your credentials: " + err.message).linebreak();;
                return cb(err, args);
              }
              args.bld.text("Credentials saved as '" + label + "'").linebreak();;
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

module.exports = save_credentials;
