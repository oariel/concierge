var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var fs = require('fs');


var is_inited = false;
var fortunes = [];

var fortune = {
    'names': ['fortune', 'wonder', 'cookie'],
    'fn': function(args, cb) {
        logger.d('Plugin: fortune');
        if (!is_inited) {
            var file = path.join(__dirname, 'fortunes.json');
            fortunes = JSON.parse(fs.readFileSync(file, 'utf8'));
            is_inited = true;
        }
        if (is_inited) {
            var q = fortunes[Math.floor(Math.random() * fortunes.length)];
            args.bld.identp().italic(q).linebreak();
            return cb(null, args);
        }
        args.bld.text('My crystal ball is cloudy right now.').linebreak();
        return cb('err', args);
    },
};

module.exports = fortune;
