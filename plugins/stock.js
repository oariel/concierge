// Stock quote plugin
//
var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var googleStocks = require('google-stocks');

var stock = {
    'names': ['stock', 'quote', 'market'],
    'fn': function(args, cb) {
        logger.d('Plugin: stock');
        args.busy();
        googleStocks(args.user_params.split(/\s/), function(error, data) {
          if ( error ) {
            args.bld.text("Sorry, I got an error requesting quotes (" + error + ")");
            return cb('err', args);
          }
          else {
            for ( var i=0; i<data.length; i++ )
                args.bld.ident().bold(data[i].t).text(" " + data[i].l + " ( " + data[i].c + ")").linebreak();
          }
          return cb(null, args);
        });
    },
};

module.exports = stock;
