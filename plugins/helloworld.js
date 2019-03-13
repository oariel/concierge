//  Plugin to receive an input
var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));

var helloworld = {
    'names': ['helloworld', 'hello'],
    'fn': function(args, cb) {

        try {
          logger.d('Plugin: helloworld');
          args.bld.text("Hello World!").linebreak();
          return cb(null, args);
        }
        catch (err) {
          logger.e(err.message);
          args.bld.text(err.message).linebreak();
          return cb(err, args);
        }
    },
};

module.exports = helloworld;
