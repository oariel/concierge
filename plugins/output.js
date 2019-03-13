//  Plugin to receive an input
var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var util = require(path.resolve(__dirname, '../lib/util.js'));
var shortener = require(path.resolve(__dirname, '../lib/urlshortener.js'));

var output = {
    'names': ['output', 'textout'],
    'fn': function(args, cb) {

        try {
          logger.d('Plugin: output');

          if (args.data.hasOwnProperty('message')) {

              var message = args.data.message;

              // Parameterize the string
              message = util.parameterize_string(message, args.variables);

              if ( args.data.hasOwnProperty('style') ) {
                var style = args.data.style;
                if ( style == 'bold' )
                  args.bld.bold(message).linebreak();
                else
                if ( style == 'italic' )
                    args.bld.italic(message).linebreak();
                else
                if ( style == 'underline' )
                    args.bld.italic(message).linebreak();
                else
                if ( style == 'strikethrough' )
                    args.bld.strikethrough(message).linebreak();
                else
                    args.bld.text(message).linebreak();
              }
              else
                args.bld.text(message).linebreak();
          }
          else
          if ( args.hasOwnProperty('user_params') && args.user_params ){
              args.bld.text(args.user_params).linebreak();
          }

          if (args.data.hasOwnProperty('link'))
              args.bld.link(args.data.link, args.data.link);

          args.bld.linebreak();
          return cb(null, args);
        }
        catch (err) {
          logger.e(err.message);
          args.bld.text(err.message).linebreak();
          return cb(err, args);
        }
    },
};

module.exports = output;
