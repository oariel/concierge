'use strict';

var path = require("path");
var argv = require('minimist')(process.argv.slice(2));
var request = require('then-request');
var message_handlers = require(path.resolve(__dirname, "../workflow/handlers.js"));
var logger = require(path.resolve(__dirname, "../lib/logger.js"));
var team_list = require(path.resolve(__dirname, './team_list.js'));

// Actions on Google
if (argv.d != undefined)
  process.env.DEBUG = 'actions-on-google:*';
const ApiAiApp = require('actions-on-google').ApiAiApp;
const Assistant = require('actions-on-google').ApiAiAssistant;

const DEFAULT_FALLBACK_INTENT = 'action.unknown';
const EXPIRE_TIMEOUT = 60;
const MAX_SUGGESTION_LENGTH = 25;

// https://developers.google.com/actions/reference/nodejs/AssistantApp
// https://github.com/actions-on-google/conversation-components-nodejs/blob/master/api-ai/index.js

var botConfig = {
  'type': 'ACTIONS ON GOOGLE',
  'progdir': path.resolve(__dirname),
  'reload_check_interval': 60 * 1000,
  'listen_port': 7001,
  'connect_retry_interval': 15 * 1000,
  'expire_interval': 1000 * EXPIRE_TIMEOUT,
  'cancel_literal': 'Cancel',
  'retry_literal': 'Hit Me Again',
  'has_voice': true
};


function actionsMessageBuilder(app) {
  var theApp = app;
  var speechText = "";
  var displayText = "";
  var attachment = null;
  var buttons = [];
  var mute = false;

  actionsMessageBuilder.prototype.reset = function () {
    speechText = "";
    displayText = "";
    attachment = null;
    buttons = [];
    mute = false;
  };

  actionsMessageBuilder.prototype.attach = function (newItem) {
    attachment = theApp.buildBasicCard(newItem.text)
      .setSubtitle(newItem.author_name)
      .setTitle(newItem.title)
      .addButton(newItem.pretext, newItem.title_link)
      .setImage(newItem.thumb_url, newItem.title);
  };

  actionsMessageBuilder.prototype.whitelistUrl = function (url, cb) {
    // Not required here
    cb(null);
  }

  actionsMessageBuilder.prototype.cancel = function (msg, callback_id) {
    buttons.push('Cancel');
    return this;
  };

  actionsMessageBuilder.prototype.text = function (arg) {
    speechText += arg;
    displayText += arg;
    return this;
  };

  actionsMessageBuilder.prototype.bold = function (arg) {
    speechText += arg;
    displayText += arg;
    return this;
  };

  actionsMessageBuilder.prototype.italic = function (arg) {
    speechText += arg;
    displayText += arg;
    return this;
  };

  actionsMessageBuilder.prototype.underline = function (arg) {
    speechText += arg;
    displayText += arg;
    return this;
  };

  actionsMessageBuilder.prototype.strikethrough = function (arg) {
    speechText += arg;
    displayText += arg;
    return this;
  };

  actionsMessageBuilder.prototype.linebreak = function () {
    speechText += ".\n";
    displayText += "\n";
    return this;
  };

  actionsMessageBuilder.prototype.ident = function () {
    return this;
  };


  actionsMessageBuilder.prototype.identp = function () {
    return this;
  };

  actionsMessageBuilder.prototype.li = function () {
    speechText += ",\n"
    displayText += "\n";
    return this;
  };


  actionsMessageBuilder.prototype.link = function (txt, href) {
    speechText += href;
    displayText += href;
    return this;
  };

  actionsMessageBuilder.prototype.toSegments = function () {
    if (attachment)
      return theApp.buildRichResponse()
        .addSimpleResponse({ speech: !speechText ? "Here you go:" : speechText, displayText: !displayText ? "Here you go:" : displayText })
        .addSuggestions(buttons)
        .addBasicCard(attachment);
    else
      return theApp.buildRichResponse()
        .addSimpleResponse({ speech: !speechText ? "Here you go:" : speechText, displayText: !displayText ? "Here you go:" : displayText })
        .addSuggestions(buttons);
  };

  actionsMessageBuilder.prototype.hasButtons = function () {
    return theApp.hasSurfaceCapability(theApp.SurfaceCapabilities.SCREEN_OUTPUT);
  };

  actionsMessageBuilder.prototype.hasCards = function () {
    return theApp.hasSurfaceCapability(theApp.SurfaceCapabilities.SCREEN_OUTPUT);
  };

  actionsMessageBuilder.prototype.addActionButton = function (name, value, i) {
    var str = value;
    if (str.length > MAX_SUGGESTION_LENGTH)
      str = str.substr(0, MAX_SUGGESTION_LENGTH - 3) + "...";
    buttons.push(str);
    return this;
  };

  actionsMessageBuilder.prototype.attachAction = function (title, callback_id, color) {
    return this;
  };

}

const bearerToken = require('express-bearer-token');
let express = require('express'),
  bodyParser = require('body-parser'),
  app = express();

app.use(bearerToken());

app.use(bodyParser.json({
  verify: function getRawBody(req, res, buf) {
    req.rawBody = buf.toString();
  }
}));

function stopResponseHandler(assistant) {
  // Complete your fulfillment logic and send a response
  var str = 'Ok';
  assistant.tell({ speech: str, displayText: str });
}

function welcomeResponseHandler(assistant) {
  // Complete your fulfillment logic and send a response
  var str = 'Hi there! Concierge is at your service.';
  assistant.tell({ speech: str, displayText: str });
}

function errorResponseHandler(assistant) {
  // Complete your fulfillment logic and send a response
  var str = 'OK, I just had an internal error. I hope that doesn\'t keep happening or they\'ll melt me down for scrap!';
  assistant.tell({ speech: str, displayText: str });
}

app.post('/hook', function (req, res) {


  var apiAiApp = new ApiAiApp({ request: req, response: res });
  var assistant = new Assistant({ request: req, response: res });
  var action = req.body.result.action;
  if (!action) {
    logger.e("Action is missing. Check your API.AI console intent defintions");
    return;
  }

  var intent = req.body.originalRequest.data.inputs[0].intent;
  logger.log("Intent: " + intent);

  //logger.print_object(req.headers);
  //logger.print_object(req.body);
  //logger.print_object(apiAiApp.SurfaceCapabilities);

  // get the access token for the user
  var userInfo = {};
 
  userInfo = { email: 'oren.ariel@spaceiq.com', name: 'Oren Ariel', given_name: 'Oren Ariel' };

  // get the NLP endpoint based on who the user is
  var cfHost = team_list.get_device_nlp_endpoint(userInfo);
  logger.log("Email: " + userInfo.email);
  logger.log("Endpoint: " + cfHost);
  if (req.token)
    logger.log("Token: " + req.token);

  var user_str = req.body.result.resolvedQuery.toLowerCase();
  var conv_id = req.body.sessionId;

  // Welcome message (Talk to..)
  if (user_str == "google_assistant_welcome") {
    user_str = "Hello";
  }

  // Cancel current session
  if (user_str == 'stop' || user_str == 'cancel' || user_str == 'abort') {
    logger.log("Cancelled");
    message_handlers.abort_followup(conv_id);
    const actionMap = new Map();
    actionMap.set(action, stopResponseHandler);
    return assistant.handleRequest(actionMap);
  }

  logger.log("USER_STR: " + user_str);
  logger.log("CONV ID: " + conv_id);
  logger.log("ACTION: " + req.body.result.action);

  var handler_args = {
    'user_properties': userInfo,
    'user_email': userInfo.email,
    'user_str': user_str,
    'user_rank': 0,
    'bot_config': botConfig,
    'user_links': [], // not used
    'user_strings': [],
    'conv_id': conv_id,
    'bld': new actionsMessageBuilder(apiAiApp),
    'cf': cfHost,
    'cb': function (err, resp) {
      //console.log(resp.items[0]);
      if (err) {
        const actionMap = new Map();
        actionMap.set(action, errorResponseHandler);
        return assistant.handleRequest(actionMap);
      }

      if (resp) {
        function askResponseHandler(assistant) {
          assistant.ask(resp);
        }

        function tellResponseHandler(assistant) {
          assistant.tell(resp);
        }

        // Send back the response
        const actionMap = new Map();
        // if the device doesn't have a screen and it's the last step - stop the conversation
        actionMap.set(action, (!apiAiApp.hasSurfaceCapability(
          apiAiApp.SurfaceCapabilities.SCREEN_OUTPUT) &&
          message_handlers.is_last_step(conv_id) &&
          (user_str != 'Hello')) ? tellResponseHandler : askResponseHandler);
        assistant.handleRequest(actionMap);
      }
    },
    'busy': function () {
    },
    'idle': function () {
    }
  };

  handle_message(handler_args, res);

});

function handle_message(handler_args, res) {
  try {
    if (message_handlers.followup_exists(handler_args.conv_id)) {
      message_handlers.complete_followup(handler_args);
    } else {
      message_handlers.start_classified(handler_args);
    }
  } catch (err) {
    const actionMap = new Map();
    actionMap.set(DEFAULT_FALLBACK_INTENT, errorResponseHandler);
    return assistant.handleRequest(actionMap);
  }
}


process.on('uncaughtException', function (error) {
  logger.e('EXCEPTION CAUGHT');
  logger.e(error.stack);
});

process.on('unhandledRejection', function (reason, p) {
  logger.e('UNHANDLED PROMISE REJECTION');
  logger.e(reason, p);
});

var welcome_msg =
  `
-------------------------------------
    Actions on Google Concierge
 Copyright(c) Oren Ariel, Inc. 2016
 Use -h or --help for argument list
-------------------------------------`;

logger.log(welcome_msg);

if (argv.h !== undefined || argv.help !== undefined) {
  logger.log("Usage: node app.js <options>");
  logger.log("Options  -p : port");
  logger.log("         -d : Actions on Google debug on");
  process.exit();
}

// Expire any unprocessed followups
setInterval(function () {
  message_handlers.expire_followups(botConfig.expire_interval/1000);
  team_list.reload_team_list(botConfig.expire_interval);
}, botConfig.expire_interval);

var listenPort = botConfig.listen_port;
if (argv.p != undefined)
  listenPort = argv.p;

logger.log('Server listening on port ' + listenPort);
app.listen(listenPort);
