///////////////////////////////////////////////////////////
// Microsoft Bot Framework Bot (teams)
// Copyright(c) 2011-2017 Capriza, Inc.
//
var path = require("path");
var argv = require('minimist')(process.argv.slice(2));
var message_handlers = require(path.resolve(__dirname, "../workflow/handlers.js"));
var logger = require(path.resolve(__dirname, "../lib/logger.js"));
var team_list = require(path.resolve(__dirname, './teamlist.js'));
var restify = require('restify');
var builder = require('botbuilder');
var teams = require("botbuilder-teams");

const EXPIRE_TIMEOUT = 180;

///////////////////////////////////////////////////////////

function teamsMessageBuilder(s) {

  var str = "";
  var attachment = {};
  var buttons = [];
  var session = s;

  teamsMessageBuilder.prototype.whitelistUrl = function (url, cb) {
      // Not required here
      cb(null);
  }

  teamsMessageBuilder.prototype.cancel = function (msg, callback_id) {
    buttons.push(builder.CardAction.imBack(this.session, "Cancel", "Cancel"));
    return this;
  };

  teamsMessageBuilder.prototype.text = function (arg) {
      str += arg;
      return this;
  };

  teamsMessageBuilder.prototype.bold = function (arg) {
      str = str + "**" + arg + "**";
      return this;
  };

  teamsMessageBuilder.prototype.italic = function (arg) {
      str = str + "*" + arg + "*";
      return this;
  };

  teamsMessageBuilder.prototype.underline = function (arg) {
      str = str + "#" + arg + "#";
      return this;
  };

  teamsMessageBuilder.prototype.strikethrough = function (arg) {
      str += arg;
      return this;
  };

  teamsMessageBuilder.prototype.linebreak = function () {
      str += "\n\n";
      return this;
  };

  teamsMessageBuilder.prototype.ident = function () {
      return this;
  };

  teamsMessageBuilder.prototype.identp = function () {
      return this;
  };

  teamsMessageBuilder.prototype.li = function () {
      str += "\n\n"
      return this;
  };

  teamsMessageBuilder.prototype.link = function (txt, href) {
      str += href;
      return this;
  };

  teamsMessageBuilder.prototype.toSegments = function () {
      var ret = str;
      str = "";
      return new Object(
          {
              "text": ret,
              "attachment": attachment.hasOwnProperty("title") ? attachment : null,
              "buttons": buttons.length > 0 ? buttons : null
          }
      );
  };

  teamsMessageBuilder.prototype.hasButtons = function () {
      return true;
  };

  teamsMessageBuilder.prototype.hasCards = function () {
      return true;
  };

  teamsMessageBuilder.prototype.addActionButton = function (name, value, i) {
    buttons.push(builder.CardAction.imBack(this.session, value, value));
    return this;
  };

  teamsMessageBuilder.prototype.attachAction = function (title, callback_id, color) {
      return this;
  };

  teamsMessageBuilder.prototype.attach = function (newItem) {

    // use the definitions previously for slack
    attachment  = {
       "title": newItem.title,
       "image_url": newItem.thumb_url,
       "author": newItem.author_name,
       "text": newItem.text,
       "pretext": newItem.pretext,
       "url": newItem.title_link
    }
  };

}

process.on('uncaughtException', function(error) {
    logger.e('EXCEPTION CAUGHT');
    logger.e(error.stack);
});

process.on('unhandledRejection', function(reason, p) {
    logger.e('UNHANDLED PROMISE REJECTION');
    logger.e(reason, p);
    //logger.log(p.exception.body.toString());
});

process.on('SIGINT', function() {
  process.exit();
});

process.on('exit', function () {
});


var welcome_msg =
    `
-------------------------------------
     Concierge for Teams Bot
 Copyright(c) Capriza, Inc. 2011
 Portions Copyright(c) LBNL 2016
 Use -h or --help for argument list
-------------------------------------`;

console.log(welcome_msg);

if (argv.h !== undefined || argv.help !== undefined) {
    console.log("Usage: node teamsBot.js <options>");
    console.log("Options  -i : Initialization file");
    process.exit();
}

// Load configuration file
var initFile = "config.js";
if ( argv.i != null )
		initFile = argv.i;
var dir = path.resolve(__dirname);
var config = require(dir + "/" + initFile);
logger.log("Initialization file: " + initFile);

var config = {
    'type': 'TEAMS',
    'progdir': path.resolve(__dirname),
    'reload_check_interval': 60 * 1000,
    'expire_interval': 1000*EXPIRE_TIMEOUT,
    'connect_retry_interval': 5 * 1000,
    'cancel_literal': 'Cancel',
    'retry_literal': 'Hit Me Again',
    'has_voice': false,
    'callback_address': process.env.callback_address
};

if ( !config.callback_address )
  logger.log("Warning: Callback address is not defined. Background runs are not supported");

// Expire any unprocessed followups
setInterval(function() {
    message_handlers.expire_followups(EXPIRE_TIMEOUT);
    team_list.reload_team_list(config.expire_interval);
}, config.expire_interval);

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 7001, function () {
   logger.log(server.name + ' listening on ' + server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new teams.TeamsChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

server.use(require('restify-plugins').queryParser());
server.use(require('restify-plugins').bodyParser());

// this will receive nothing, you can put your tenant id in the list to listen
connector.setAllowedTenants([]);
// this will reset and allow to receive from any tenants
connector.resetAllowedTenants();

var connectorListener = connector.listen();
function listenWrapper() {
    return function (req, res) {
        try {
          // Capture the host name for the hosted application
          sourceUrl = req.headers['x-forwarded-proto'] + '://' + req.headers['host'];
          connectorListener(req, res);
        } catch (err) {
            console.log(err.message);
        }
    };
}
// Find a user bu Id
function findUser(connector, session, conv_id, id, cb) {
    connector.fetchMemberList(
      session.message.address.serviceUrl,
      conv_id,
      teams.TeamsMessage.getTenantId(session.message),
      function (err, result) {
          if (err) {
            logger.e('Error fetching team roster');
          }
          else {
            for (var i=0; i<result.length; i++) {
                if (result[i].id == id ) {
                    if ( result[i].email )
                      return cb({ email: result[i].email, name: result[i].name, given_name: result[i].givenName });
                }
            }
          }
          // returns demo user
          return cb({ email: 'caprizapartner@gmail.com', name: 'Demo User', given_name: '.' })
    });
}

// Listen for messages from users
server.post('/api/messages', listenWrapper());

// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')
var bot = new builder.UniversalBot(connector, function (session) {

    //console.log(session);
    var user_id = session.message.user.id;
    var user_str = session.message.text;

    // Remove everything with tags (tags appear when the bot is in a conversation)
    user_str = user_str.replace(/<at>(.|\n|\r)+<\/at>/g, "");
    user_str = user_str.replace("<at></at>", "");
    user_str = user_str.trim();

    // handle empty inpt (Cortana)
    if ( !user_str )
        user_str = "Hello";

    var conv_id = session.message.address.conversation.id;
    var bld = new teamsMessageBuilder(session);

    logger.log("USER_STR:" + user_str);

    // Find out who's the user
    findUser(connector, session, conv_id, user_id, function(userInfo) {

        // get the NLP endpoint based on who the user is
        var cfHost = team_list.get_device_nlp_endpoint(userInfo);
        logger.log("Email: " + userInfo.email);
        logger.log("Endpoint: " + cfHost);

        var handler_args = {
            'user_properties': new Object( {session: session, user_info: userInfo} ),
            'user_email': userInfo.email,
            'user_str': user_str,
            'user_rank': 0,
            'bot_config': config,
            'user_links': [], // not used
            'user_strings': [], // not used
            'conv_id': conv_id, // will be used for unique followup index
            'bld': bld,
            'cf': cfHost,
            'cb': function(err, resp) {
                session.sendTyping();
                if (err)
                  session.send('OK, I just had an internal error. I hope that doesn\'t keep happening or they\'ll melt me down for scrap!');
                else {
                  if ( resp.attachment ) {
                    if ( resp.text.length > 0 )
                      session.send(resp.text);

                    // Get the Zapp token
                    var msg = resp.attachment.text;
                    var parts = resp.attachment.url.split("/");
                    var token = parts[parts.length-1];
                    token = token.split("?")[0];

                    // Success in getting the token
                    if (token.length == 22)
                        msg = msg + " Copy this token to share it with your team as a tab: " + token;

                    var card = new builder.ThumbnailCard(session)
                         .title(resp.attachment.title)
                         .subtitle("By: " + resp.attachment.author)
                         .text(msg)
                         .images([
                             builder.CardImage.create(session, resp.attachment.image_url)
                         ])
                         .buttons([
                             builder.CardAction.openUrl(session, resp.attachment.url, resp.attachment.pretext)
                         ]);
                    var msg = new builder.Message(session).addAttachment(card);
                    session.send(msg);
                  }
                  else
                  if ( resp.buttons ) {
                    if ( resp.text.length > 0 )
                      session.send(resp.text);
                    var card = new builder.HeroCard(session)
                         .buttons(resp.buttons);
                    var msg = new builder.Message(session).addAttachment(card);
                    session.send(msg);
                  }
                  else
                    session.send(resp.text);
                }
            },
            'busy': function() {
            },
            'idle': function() {
            }
        };

        handle_message(handler_args);

    });

});

// Send an intro meeting to a new team member
bot.on('conversationUpdate', (msg) => {

    // Loop through all members that were just added to the team
    var members = msg.membersAdded;
    if (members) {
        for (var i = 0; i < members.length; i++) {
            var botmessage = new builder.Message()
                .address(msg.address)
                .text('Welcome to the team! I can help you get work done more effectively, directy from Teams. To get started, please reply to this message, and say \'hi\'.');
            bot.send(botmessage, function(err) {});
        }
    }
});

function handle_message(handler_args) {
    try {
      if (message_handlers.followup_exists(handler_args.conv_id)) {
          message_handlers.complete_followup(handler_args);
      } else {
          message_handlers.start_classified(handler_args);
      }
    } catch (err) {
        logger.e(err.message);
    }
}
