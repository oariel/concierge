// Stock quote plugin
//
var path = require("path");
var request = require('then-request');
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var shortener = require(path.resolve(__dirname, '../lib/urlshortener.js'));
const favIcon = "https://www.capriza.com/wp-content/themes/capriza/favicon.ico";

var zoom = {
    'names': ['zoom', 'zoom.us', 'meeting'],
    'fn': function(args, cb) {

        logger.d('Plugin: zoom');
        args.busy();

        var email = args.user_email;
        if ( !email ) {
            logger.d("Unknown username");
            args.bld.text("Unknown username");
            return cb(null, args);
        }

        var str;
        var resp = [];

        try {
            var url = 'https://api.zoom.us/v1/user/list/?api_key=_dwvcw-FT5OhoPodZP6xqQ&api_secret=AQmxGylutlTh5lK1pfORlU9BWwCeq2Vfa0YY&data_type=JSON&page_size=999';
            var res = request('POST', url).done(function (res) {

                var userList = JSON.parse(res.getBody('utf8'));

                var i = 0;
                var found = false;
                for (i=0; i<userList.users.length; i++ ) {
                    if ( userList.users[i].email == email ) {
                      found = true;
                      break;
                    }
                }

                // User not found
                if ( !found ) {
                    logger.d("Zoom user " + email + " doesn't exist.");
                    args.bld.text("Zoom user " + email + " doesn't exist.");
                    return cb(null, args);
                }

                logger.d("Found Zoom user " + email);
                var id = userList.users[i].id;
                var url = 'https://api.zoom.us/v1/meeting/create/?api_key=_dwvcw-FT5OhoPodZP6xqQ&api_secret=AQmxGylutlTh5lK1pfORlU9BWwCeq2Vfa0YY&data_type=JSON&host_id=' + id + '&topic=' + args.user_params + '&type=1&option_audio=voip';
                var res = request('POST', url).done(function (res) {

                    str = res.getBody('utf8');
                    var meeting = JSON.parse(str);

                    // Shorten the meeting url
                    shortener.shorten(meeting.start_url, function (err, shortUrl) {
                        if ( !args.bld.hasCards() ) {
                            args.bld
                                .text('Meeting topic: ').linebreak().bold(meeting.topic).linebreak().linebreak()
                                .text('Click to start the meeting: ').linebreak()
                                .link(shortUrl.id, shortUrl.id).linebreak().linebreak()
                                .text('Join URL (send to attendees): ').linebreak()
                                .link(meeting.join_url, meeting.join_url).linebreak()
                            return cb(null, args);
                        }
                        else {
                          var num = meeting.join_url.split('/').pop();
                          var meetingNumber = num.substr(0,3) + "-" + num.substr(3,3) + "-" + num.substr(6,3);
                          args.bld.text('The meeting number is: ').linebreak().bold(meetingNumber).linebreak();
                          var attachment = new Object(
                          {
                            "fallback": "Tap/click to start meeting: " + " <" + shortUrl.id + "|" + args.user_params + ">",
                            "pretext": "Start Meeting",
                            "title": "Zoom Meeting: " + meeting.topic + " (" + meetingNumber + ")",
                            "title_link": shortUrl.id,
                            "text": "Join URL (send to attendees): " + meeting.join_url,
                            "footer_icon": favIcon,
                            "footer": "Powered by Capriza",
                            "color": "good"
                          });

                          // some messemgers require that the URL will be whitelisted
                          args.bld.whitelistUrl(url, function(error) {
                            args.bld.attach(attachment);
                            return cb(null, args);
                          });
                        }
                  });
                });
            });
        }
        catch(err) {
            logger.e("Failed to create Zoom meeting: " + err.statusCode);
            return cb(err, "Failed to create Zoom meeting: " + err.statusCode);
        }


    },
};

module.exports = zoom;
