//  Plugin to receive an input
var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));

var select = {
    'names': ['select', 'branch', 'fork'],
    'fn': function(args, cb) {

        try {
          logger.d('Plugin: select');
          var options = args.data.options;
          for ( var i=0; i<options.length; i++) {
              args.step_result.push( {name: options[i].name, value: options[i].value} );
          }
          return cb(null, args);
        }
        catch (err) {
          logger.e(err.message);
          args.bld.text(err.message).linebreak();
          return cb(err, args);
        }
    },
};

module.exports = select;
