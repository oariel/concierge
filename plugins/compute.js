//  Plugin to receive an input
var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var util = require(path.resolve(__dirname, '../lib/util.js'));

// See: https://www.npmjs.com/package/validator for validator syntax
var validator = require('validator');

var compute = {
    'names': ['compute', 'process'],
    'fn': function(args, cb) {

        try {
          logger.d('Plugin: compute');

          // get the variable to gather the input into
          var code = args.data.code;

          if (code) {
            code = util.parameterize_string(code, args.variables);
            logger.log(code);
            eval("function resolve() {" + code + "}");
            var ret = resolve();
            var newVar = args.data.variable_name;
            if ( newVar ) {
              logger.log("Compute: " + newVar + " <== " + ret);
              args.variables.push( {name: newVar, value: ret} );
            }
            return cb(null, args);
          }

        }
        catch (err) {
          logger.e(err.message);
          args.bld.text(err.message).linebreak();
          return cb(err, args);
        }
    },
};

module.exports = compute;