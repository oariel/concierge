//  Plugin to receive an input
var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));

var condition = {
    'names': ['condition'],
    'fn': function(args, cb) {

        try {
          logger.d('Plugin: condition');
          var literal = args.user_params;
          for ( var i=0; i<args.data.conditions.length; i++ ) {
            var val = args.data.conditions[i].value;
            if ( val == "*" || val == literal ) {
              args.next_step = args.data.conditions[i].gotostep;
              logger.d("value: " + val + ", next step: " + args.next_step);
              return cb(null, args);
            }
          }
          // Do nothing
          return cb(null, args);
        }
        catch (err) {
          logger.e(err.message);
          args.bld.text(err.message).linebreak();
          return cb(err, args);
        }
    },
};

module.exports = condition;
