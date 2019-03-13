//  Plugin to receive an input
var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));

var geopermission = {
    'names': ['geopermission'],
    'fn': function(args, cb) {

        try {
          logger.d('Plugin: geopermission');
          if ( args.bot_config.hasOwnProperty("has_location") && args.bot_config.has_location ) {
              args.bld.getLocationPermission(args.conv_id);
          }
          else
            args.bld.text("Location services are not supported for this device").linebreak();
          return cb(null, args);
        }
        catch (err) {
          logger.e(err.message);
          args.bld.text(err.message).linebreak();
          return cb(err, args);
        }
    },
};

module.exports = geopermission;
