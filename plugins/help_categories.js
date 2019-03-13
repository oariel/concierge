var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var nlp = require(path.resolve(__dirname, '../nlp/classifier.js'));

var help_categories = {
    'names': ['help_categories'],
    'fn': function(args, cb) {
        try {
            logger.d('Plugin: help_categories');
            args.busy();
            nlp.nlp_help( args.cf, 'categories', function(categories, err) {
              for (var i=0; i<categories.length; i++)
                  args.step_result.push( {name: categories[i], value: categories[i]} );
              args.idle();
              return cb(null, args);
            });
        }
        catch (err) {
          logger.e(err.message);
          args.cb(null, err.message);
          return cb(err, args);
        }
    },
};

module.exports = help_categories;
