var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var nlp = require(path.resolve(__dirname, '../nlp/classifier.js'));

function randomIndex(min,max) {
    return Math.floor(Math.random()*(max-min+1)+min);
}

var suggestion = {
    'names': ['suggestion'],
    'fn': function(args, cb) {
        try {
            var count = 1;
            if (args.data.hasOwnProperty('count'))
                count = parseInt(args.data.count);

            logger.d('Plugin: suggestion');
            args.busy();

            // Presets can be specified via an array
            if (args.data.hasOwnProperty('presets')) {
               var presets = args.data.presets;
               for ( var i=0; i<presets.length; i++ )
                  args.step_result.push( {name: presets[i], value: presets[i]} );
               count -= i;
            }

            nlp.nlp_help( args.cf, 'phrases', function(phrases, err) {
                for ( var i=0; i<count; i++ ) {
                  var j = randomIndex(0,phrases.length-1);
                  var k = randomIndex(0,phrases[j].phrases.length-1);
                  args.step_result.push( {name: phrases[j].phrases[k], value: phrases[j].phrases[k]});
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


module.exports = suggestion;
