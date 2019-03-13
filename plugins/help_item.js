var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var nlp = require(path.resolve(__dirname, '../nlp/classifier.js'));

var help_item = {
    'names': ['help_item'],
    'fn': function(args, cb) {
        try {
            var category = args.user_params.toLowerCase();
            logger.d('Plugin: help_item (' + category + ')');
            args.busy();
            args.bld.bold("Supported phrases for '" + category).text("':").linebreak().linebreak();
            nlp.nlp_help( args.cf, 'phrases', function(phrases, err) {
                for (var j=0; j<phrases.length; j++) {
                    var phraseItem = phrases[j];
                    if (category == phraseItem.category.toLowerCase()) {
                        for (var k=0; k<phrases[j].phrases.length; k++) {
                            args.step_result.push( {name: phrases[j].phrases[k], value: phrases[j].phrases[k]} );
                        }
                    }
                }
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


module.exports = help_item;
