// Plugin to receive an input
var path = require("path");
var request = require('then-request');
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var key = "4c1c4dc4a5f066a7e705b0564a692433";

function getForecast(loc, key, units, cb) {

  var str;
  try {
      var url = 'http://api.openweathermap.org/data/2.5/forecast?q=' + loc + '&mode=json&appid=' + key + "&units=" + units;
      request('GET', url).done(function (res) {
          str = res.getBody('utf8');
          data = JSON.parse(str);
          return cb(null, data);
      });
  } catch(err) {
      logger.e("Failed to get weather forecast '" + loc + "': " + err);
      return cb(err, null);
  }

}


var weather = {
    'names': ['weather'],
    'fn': function(args, cb) {

        try {
            logger.d('Plugin: weather');
            var units = args.data.units;
            if (units == undefined)
                units = "metric";

            var user_param = args.user_params;

            // Overrides user input
            if (args.data.hasOwnProperty("default") && args.data.default) {
              user_param = args.data.default;

              // Replace variables in code with value
              for (var i = 0; i<args.variables.length; i++) {
                  if ( user_param.indexOf(args.variables[i].name) >= 0 )
                    user_param = user_param.replace(args.variables[i].name, args.variables[i].value);
              }
            }

            getForecast(user_param, key, units, function (err, forecast) {
                if ( forecast != undefined ) {
                    var mapUrl = "http://maps.google.com/maps?z=12&t=m&q=" + encodeURIComponent(user_param);
                    args.bld
                      .bold("5 day weather forecast for " + forecast.city.name + ", " + forecast.city.country).linebreak()

                    for ( var i=0; i<forecast.list.length; i++) {
                        // This is 3 hour forecast so use just one entry from each day
                        if ( forecast.list[i].dt_txt.indexOf("00:00:00") >= 0 ) {
                            var u = (units=="imperial") ? "F" : "C";
                            args.bld
                                .bold(forecast.list[i].dt_txt.replace(" 00:00:00", "") + ":").linebreak()
                                .ident().text("Temperature (" + u + "): " + forecast.list[i].main.temp).linebreak()
                                .ident().text("Range (" + u + "): " + forecast.list[i].main.temp_min + " - " + forecast.list[i].main.temp_max).linebreak()
                                .ident().text("Humidity (%): " + forecast.list[i].main.humidity).linebreak()
                                .ident().text("Outlook: " + forecast.list[i].weather[0].main + " - " + forecast.list[i].weather[0].description).linebreak().linebreak();
                        }
                    }
                    if ( !args.bld.hasCards() )
                        args.bld.link("Show on map", mapUrl).linebreak();
                    else {
                        var attachment = new Object(
                        {
                            "fallback": "Show on map" + " <" + mapUrl + "|" + "Map" + ">",
                            "title": "Show area map for " + forecast.city.name + ", " + forecast.city.country,
                            "pretext": "Open in Maps",
                            "title_link": mapUrl,
                            "color": "good"
                        });
                        // some messemgers require that the URL will be whitelisted
                        args.bld.whitelistUrl(mapUrl, function(error) {
                          args.bld.attach(attachment);
                          //return cb(null, args);
                        });
                    }
                }
                else
                    args.bld.text("Sorry. No info found.")
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

module.exports = weather;
