var path = require('path');
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var fs = require('fs');

var load_plugins = function() {
    var plugins = {};
    var plugindir = path.join(__dirname, '../plugins');
    fs.readdirSync(plugindir).forEach(function(file) {
        if (file.match(/\.js$/)) {
            logger.l('reading file: ' + file);
            var abspath = path.join(plugindir, file);
            var plugin = require(abspath);
            for (var i = 0; i < plugin.names.length; i++) {
                plugins[plugin.names[i]] = plugin.fn;
            }
        }
    });
    return plugins;
};

module.exports = load_plugins();