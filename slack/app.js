"use strict";

var path = require("path");
var argv = require('minimist')(process.argv.slice(2));
var message_handlers = require(path.resolve(__dirname, "../workflow/handlers.js"));
var logger = require(path.resolve(__dirname, "../lib/logger.js"));
var Botkit = require('botkit');
var request = require('then-request');
var teamList = require(path.resolve(__dirname,'./teamList.js'));
var url = require('url');

const DEFAULT_EXPIRE_INTERVAL_SEC = 180;

function slackMessageBuilder() {

  var str = "";

  var attachment = new Object(
  {
      "attachments": []
  });

  slackMessageBuilder.prototype.whitelistUrl = function (url, cb) {
      // Not required here
      cb(null);
  }

  slackMessageBuilder.prototype.getAttachments = function (i) {
      if ( attachment.attachments.length > 0 )
        return attachment;
      else
        return null;
  };

  slackMessageBuilder.prototype.attach = function (newItem) {
      attachment.attachments.push(newItem);
      return attachment.attachments.length-1;
  };

  slackMessageBuilder.prototype.attachAction = function (title, callback_id, color) {
      var newItem = new Object({
        "title": "",
        "fallback": "Sorry, you are unable to choose an option",
        "callback_id": callback_id,
        "color": "good",
        "attachment_type": "default",
        "actions": [],
        "footer": "Click " + botConfig.cancel_literal + " to abort"
      });

      newItem.title = title;
      newItem.callback_id = callback_id;
      newItem.color = color;
      attachment.attachments.push(newItem);
      return this;
  };

  slackMessageBuilder.prototype.addActionButton = function (name, value, i, t) {
      var type = t;
      if ( !type )
          type = "button";

      var index = (i == null) ? attachment.attachments.length-1 : i;
      if ( index >= 0 )
        if (type == "select") {
          if ( !attachment.attachments[index].actions.hasOwnProperty("name") ) {
              var select =
              {
                    name: "select_option",
                    text: "Select an option...",
                    type: "select",
                    options: []
              }
              attachment.attachments[index].actions.push(select);
          }
          var item =
          {
            text: value,
            value: value
          }
          attachment.attachments[index].actions[0].options.push(item);
        }
        else
        if ( type == "button") {
          attachment.attachments[index].actions.push(
            {
              name: name,
              text: value,
              value: value,
              type: "button"
            });
        }
      return this;
  };

  slackMessageBuilder.prototype.cancel = function (msg, callback_id) {
    var newItem = new Object({
      "fallback": msg,
      "color": "good",
      "callback_id": callback_id,
      "actions":
      [
        {
          name: "-1",
          text: botConfig.cancel_literal,
          value: botConfig.cancel_literal,
          type: "button"
        }
      ],
      "footer": "Select an action or say '" + botConfig.cancel_literal + "' to abort"
    });
    attachment.attachments.push(newItem);
    return this;
  };

  slackMessageBuilder.prototype.text = function (arg) {
      str += arg;
      return this;
  };

  slackMessageBuilder.prototype.bold = function (arg) {
      str += '*' + arg + '*';
      return this;
  };

  slackMessageBuilder.prototype.italic = function (arg) {
      str += '_' + arg + '_';
      return this;
  };

  slackMessageBuilder.prototype.underline = function (arg) {
      str += arg;
      return this;
  };

  slackMessageBuilder.prototype.strikethrough = function (arg) {
      str += '~' + arg + '~';
      return this;
  };

  slackMessageBuilder.prototype.linebreak = function () {
      str += "\n";
      return this;
  };

  slackMessageBuilder.prototype.ident = function () {
      str += ">";
      return this;
  };

  slackMessageBuilder.prototype.identp = function () {
      str += ">>>";
      return this;
  };

  slackMessageBuilder.prototype.li = function () {
      str += "• ";
      return this;
  };

  slackMessageBuilder.prototype.link = function (txt, href) {
      str += "<" + href + "|" + txt + ">";
      return this;
  };

  slackMessageBuilder.prototype.toSegments = function () {
      return this;
  };

  slackMessageBuilder.prototype.toString = function () {
      return str;
  };

  slackMessageBuilder.prototype.hasButtons = function () {
      return true;
  };

  slackMessageBuilder.prototype.hasCards = function () {
      return true;
  };
}

if ( !argv.d ) {
  process.on('uncaughtException', function(error) {
      logger.e('EXCEPTION CAUGHT');
      logger.e(error.stack);
  });

  process.on('unhandledRejection', function(reason, p) {
      logger.e('UNHANDLED PROMISE REJECTION');
      logger.e(reason, p);
      //logger.log(p.exception.body.toString());
  });
}

var welcome_msg =
    `
-------------------------------------
   Concierge Slack Chat Bot
 Copyright(c) Oren Ariel 2019
 Portions Copyright(c) LBNL 2016
 Use -h or --help for argument list
-------------------------------------`;

logger.log(welcome_msg);

if (argv.h !== undefined || argv.help !== undefined) {
    logger.log("Usage: node app.js <options>");
    logger.log("Options  -i : Initialization file");
    process.exit();
}

// Load configuration file
var initFile = "config";
if ( argv.i != null )
		initFile = argv.i;
var dir = path.resolve(__dirname);
var config = require(dir + "/" + initFile);

logger.log("Initialaztion file: " + dir + "/" + initFile);

var botConfig = {
    'type': 'SLACK',
    'progdir': path.resolve(__dirname),
    'expire_interval': DEFAULT_EXPIRE_INTERVAL_SEC * 1000,
    'listen_port': 2090,
    'connect_retry_interval': 5 * 1000,
    'cancel_literal': 'Cancel',
    'retry_literal': 'Hit Me Again',
    'has_voice': false
};

// Debug mode
if ( argv.d ) {
  botConfig.expire_interval = DEFAULT_EXPIRE_INTERVAL_SEC * 100;
  logger.log("Expire interval: " + botConfig.expire_interval/1000 + " sec.");
}

// Expire any unprocessed followups
setInterval(function() {
    message_handlers.expire_followups(botConfig.expire_interval/1000);

    // Reload team list
    delete require.cache[path.resolve(__dirname,'./teamList.js')];
    teamList = require(path.resolve(__dirname,'./teamList.js'));

}, botConfig.expire_interval/2);

if (!process.env.clientId || !process.env.clientSecret || !process.env.port) {
  logger.log('Error: Specify clientId clientSecret and port in environment');
  process.exit(1);
}

var controller = Botkit.slackbot({
  clientSigningSecret: process.env.clientSecret,
  // interactive_replies: true, // tells botkit to send button clicks into conversations
  json_file_store: path.resolve(__dirname) + '/db_slackbutton_bot/',
  debug: argv.d != undefined,
  // rtm_receive_messages: false, // disable rtm_receive_messages if you enable events api
}).configureSlackApp(
  {
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    scopes: ['bot'],
  }
);

controller.setupWebserver(process.env.port,function(err,webserver) {
  controller.createWebhookEndpoints(controller.webserver);

  controller.createOauthEndpoints(controller.webserver,function(err,req,res) {
    if (err) {
      res.status(500).send('ERROR: ' + err);
    } else {
      res.send("You've successfully installed this Slack app. You may now close this window.");
    }
  });
  
});

// Get a user email
function find_user_email(bot, userId, cb) {
    bot.api.users.list({}, function(err, m){
        if ( !m || !m.members ) 
          return cb(null);
          
        for ( var i=0; i<m.members.length; i++ ) {
            if ( m.members[i].id == userId )
                return cb (m.members[i].profile.email);
        }
    });
}

// Attachment manipulation
function handle_attachments(att, text, reply_att, callback_id) {

    if ( text.toLowerCase() == "help" )
        return;

    // Command with no attachments - add a retry button if there's history
    if ( !att ) {
	     // Always append a 'Hit Me Again' attachment
       if ( message_handlers.has_history(callback_id) ) {
          reply_att.push(
            {
              "fallback": "Not what you expected? Say ''" + botConfig.retry_literal + "'' to try the next matching phrase",
              "color": "warning",
              "callback_id": callback_id,
              "actions":
              [
                {
                  name: "-2",
                  text: botConfig.retry_literal,
                  value: botConfig.retry_literal,
                  type: "button"
                }
              ],
              "footer": "Not what you expected? Click ''" + botConfig.retry_literal + "'' to try the next matching phrase"
            }
          );
        }
    }

    else {
        // Command with attachments - add all attachments and insert a retry button is there's history
        for ( var i=0; att && i<att.attachments.length; i++ ) {
      	  if (att.attachments[i].actions) {
              if ( i == att.attachments.length-1 && message_handlers.has_history(callback_id) ) {
                  att.attachments[i].fallback += " Not what you expected? Click ''" + botConfig.retry_literal + "'' to try the next matching phrase";
                  att.attachments[i].footer += " Not what you expected? Click ''" + botConfig.retry_literal + "'' to try the next matching phrase";
                  att.attachments[i].actions.push(
                    {
                      name: "-2",
                      text: botConfig.retry_literal,
                      value: botConfig.retry_literal,
                      type: "button"
                    }
                  );
              }
              reply_att.push(att.attachments[i]);
      	  }
      	  else {
              reply_att.push(att.attachments[i]);
              reply_att.push(
                  {
                    "fallback": "Not what you expected? Say ''" + botConfig.retry_literal + "'' to try the next matching phrase",
                    "color": "warning",
                    "callback_id": callback_id,
                    "actions":
                    [
                      {
                        name: "-2",
                        text: botConfig.retry_literal,
                        value: botConfig.retry_literal,
                        type: "button"
                      }
                    ],
                    "footer": "Not what you expected? Click ''" + botConfig.retry_literal + "'' to try the next matching phrase"
                  }
                );
      	 }
      }
    }
}

// just a simple way to make sure we don't
// connect to the RTM twice for the same team
var _bots = {};
function trackBot(bot) {
  _bots[bot.config.token] = bot;
}

function get_team_nlp_endpoint(teamId, defIndex, cb) {

  controller.storage.teams.all(function(err,teams) {

    // Find team URL and NLP service endpoint
    for (var t in teams) {
      if (teams[t].id == teamId) {
          for ( var i=0; i<teamList.length; i++) {
              var host = url.parse(teams[t].url).host;
              if ( teamList[i].team == host ) {
                  return cb(teamList[i].endpoint);
              }
          }
      }
    }

    // Default item is returned if no match
    return cb(teamList[defIndex].endpoint);
  });
}

controller.on('interactive_message_callback', function(bot, message) {

      bot.api.reactions.add({
        timestamp: message.message_ts,
        channel: message.channel,
        name: 'robot_face',
      },function(err) {
        if (err) { logger.log(err) }

        if (message.actions[0].type == "button" ) {

            var index = parseInt(message.actions[0].name) + 1;
            logger.log('BUTTON CLICKED: \'' + message.text + '\' (' + index + ')');

            // Special buttons
            var user_str = "";
            if (index == 0)
                user_str = botConfig.cancel_literal;
            else
            if ( index == -1 )
                user_str = botConfig.retry_literal;
            else
                user_str = index.toString()

        }
        else
        if (message.actions[0].type == "select" ) {
            var selectedStr = message.actions[0].selected_options[0].value;
            for ( var i=0; i<message.original_message.attachments[0].actions[0].options.length; i++) {
                if ( selectedStr == message.original_message.attachments[0].actions[0].options[i].value )
                    user_str = (i+1).toString();
            }
        }
        else {
            logger.e("Interactive message: Unknwon action type.");
            return;
        }

        find_user_email(bot, message.user, function(email) {

            get_team_nlp_endpoint(message.team.id, 0, function(nlp_endpoint) {

                var bld = new slackMessageBuilder();
                var handler_args = {
                    'user_properties': message.user,
                    'user_email': email,
                    'user_str': user_str,
                    'user_rank': 0,
                    'bot_config': botConfig,
                    'user_links': [], // not used
                    'user_strings': [], // not used
                    'conv_id': message.callback_id, // will be used for unique followup index
                    'bld': bld,
                    'cf': nlp_endpoint,
                    'cb': function(err, resp) {
                        if (err) {
                            resp = bld
                                .text('OK, I just had an internal error. I hope that doesn\'t keep happening or they\'ll melt me down for scrap!')
                                .linebreak()
                                .text(err);
                        }
                        var reply = {
                            text: resp.toString(),
                            attachments: [],
                        }

                        // Add the attachment
                        handle_attachments(resp.getAttachments(), reply.text, reply.attachments, message.channel);

                        bot.reply(message, reply);
                    },
                    'busy': function() {
                    },
                    'idle': function() {
                    }
                };

                message_handlers.complete_followup(handler_args);
              });
          });
    });

});

controller.on('create_bot',function(bot,config) {

  if (_bots[bot.config.token]) {
    // already online! do nothing.
  } else {
    bot.startRTM(function(err) {

      if (!err) {
        trackBot(bot);
      }


      bot.startPrivateConversation({user: config.createdBy},function(err,convo) {
        if (err) {
          logger.log(err);
        } else {
          convo.say('I\'m your Concierge and I\'ve just joined your team. Just say \'help\' to see what I\'ve been trained on.');
          convo.say('You can now /invite me to a channel so that I can be of use!');
        }
      });

    });
  }
});

controller.on('team_join',function(bot, team) {

    // Send a DM to the user
    bot.startPrivateConversation({user: team.user.id},function(err,convo) {
      if (err) {
        logger.log(err);
      } else {
        convo.say('Welcome to the team, ' + team.user.name + '! I am the ' + bot.identity.name + ' bot. Just say \'help\' to see what I\'ve been trained on.');
      }
    });

});


// Handle events related to the websocket connection to Slack
controller.on('rtm_open',function(bot) {
  logger.log('** The RTM api just connected!');

  controller.storage.teams.all(function(err,teams) {
    for (var t in teams) {
      if (teams[t].id == bot.team_info.id) {
          var host = url.parse(teams[t].url).host;
          logger.log("Bot @" + bot.identity.name + " in Team " + host + " in online!");
      }
    }
  });

});

controller.on('rtm_close',function(bot) {
  logger.log('** The RTM api just closed');

  controller.storage.teams.all(function(err,teams) {
    for (var t in teams) {
      if (teams[t].id == bot.team_info.id) {
          var host = url.parse(teams[t].url).host;
          logger.log("Bot @" + bot.identity.name + " in Team: " + host + " has gone offline.");
      }
    }
  });
});

controller.on(['direct_message','mention','direct_mention'],function(bot,message) {
  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'robot_face',
  },function(err) {
    if (err) { logger.log(err) }
    try {

      find_user_email(bot, message.user, function(email) {

        get_team_nlp_endpoint(message.team, 0, function(nlp_endpoint) {

          // Clean the message from any user ids and URLs
          var user_str = "";

          // Input text contains email? Slack will forward this as <mailto:email|email>
          if ( message.text.indexOf('mailto:') != -1 ) {
            var emails = message.text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
            if (emails && emails.length )
              user_str = emails[0];
          }
          else 
            user_str = message.text.replace(/\<(.*?)\>/g, "").trim();
          logger.log("USER_STR: " + user_str + " USER_EMAIL: " + email);

          var bld = new slackMessageBuilder();

          var handler_args = {
              'user_properties': message.user,
              'user_email': email,
              'user_str': user_str,
              'user_rank': 0,
              'bot_config': botConfig,
              'user_links': [], // not used
              'user_strings': [], // not used
              'conv_id': message.channel, // will be used for unique followup index
              'bld': bld,
              'cf': nlp_endpoint,
              'cb': function(err, resp) {
                  if (err) {
                      resp = bld
                          .text('OK, I just had an internal error. I hope that doesn\'t keep happening or they\'ll melt me down for scrap!')
                          .linebreak()
                          .text(err);
                  }
                  var reply = {
                      text: resp.toString(),
                      attachments: [],
                  }

                  // Add the attachment
                  handle_attachments(resp.getAttachments(), reply.text, reply.attachments, message.channel);

                  bot.reply(message, reply);
              },
              'busy': function() {
              },
              'idle': function() {
              }
          };

          handle_message(handler_args);

        });

      });
   }
   catch (err) {
      logger.e(err);
   }

  });
});

controller.storage.teams.all(function(err,teams) {

  if (err) {
    throw new Error(err);
  }

  // connect all teams with bots up to slack!
  for (var t in teams) {
    if (teams[t].bot) {
      teams[t].bot.retry = Infinity;
      controller.spawn(teams[t]).startRTM(function(err, bot) {
        if (err) {
          logger.log('Error connecting bot to Slack:',err);
        } else {
          trackBot(bot);
        }
      });
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

