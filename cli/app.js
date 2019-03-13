var path = require("path");
var argv = require('minimist')(process.argv.slice(2));
var message_handlers = require(path.resolve(__dirname, "../workflow/handlers.js"));
var prompt = require('prompt');
var colors = require("colors/safe");

const DEFAULT_NLP_ENDPOINT = "http://0.0.0.0:2197";

process.on('uncaughtException', function(error) {
    console.log('EXCEPTION CAUGHT');
    console.log(error.stack);
});

process.on('unhandledRejection', function(reason, p) {
    console.log('UNHANDLED PROMISE REJECTION');
    console.log(reason, p);
});

// Message builder
function messageBuilder() {

    var str = "";
  
    messageBuilder.prototype.whitelistUrl = function (url, cb) {
        // Not required here
        cb(null);
    }
  
    messageBuilder.prototype.cancel = function (msg, callback_id) {
      str += msg;
      return this;
    };
  
    messageBuilder.prototype.text = function (arg) {
        str += arg;
        return this;
    };
  
    messageBuilder.prototype.bold = function (arg) {
        str += colors.yellow(arg);
        return this;
    };
  
    messageBuilder.prototype.italic = function (arg) {
        str += arg;
        return this;
    };
  
    messageBuilder.prototype.underline = function (arg) {
        str += arg;
        return this;
    };
  
    messageBuilder.prototype.strikethrough = function (arg) {
        str += arg;
        return this;
    };
  
    messageBuilder.prototype.linebreak = function () {
        str += "\n";
        return this;
    };
  
    messageBuilder.prototype.ident = function () {
        return this;
    };
  
    messageBuilder.prototype.identp = function () {
        return this;
    };
  
    messageBuilder.prototype.li = function () {
        str += "\n"
        return this;
    };
  
    messageBuilder.prototype.link = function (txt, href) {
        str += href;
        return this;
    };
  
    messageBuilder.prototype.toSegments = function () {
        var ret = str;
        str = "";
        return colors.yellow(ret);
    };
  
    messageBuilder.prototype.hasButtons = function () {
        return false;
    };
  
    messageBuilder.prototype.hasCards = function () {
        return false;
    };
  
    messageBuilder.prototype.addActionButton = function (name, value, i) {
        return this;
    };
  
    messageBuilder.prototype.attachAction = function (title, callback_id, color) {
        return this;
    };

  }

var welcome_msg =
  `
-------------------------------------
CLI NLP Test 
Copyright(c) Capriza, Inc. 2016
Use -h or --help for argument list
-------------------------------------`;

console.log(welcome_msg);

if (argv.h !== undefined || argv.help !== undefined) {
  console.log("Usage: node app.js -n NLP endpoint");
  process.exit();
}  

// NLP endpoint
var nlpEndpoint = argv.n;
if ( !nlpEndpoint )
    nlpEndpoint = DEFAULT_NLP_ENDPOINT;
console.log("NLP Endpoint: " + nlpEndpoint);

//
// Start the prompt
//
prompt.start();
prompt.message = colors.yellow("Concierge");
prompt.delimiter = colors.white(": ");

//
// Get two properties from the user: username and email
//

var config = {
    'type': 'CLI',
    'progdir': path.resolve(__dirname),
    'reload_check_interval': 60 * 1000,
    'connect_retry_interval': 15 * 1000,
    'cancel_literal': 'Cancel',
    'retry_literal': 'Hit Me Again',
    'has_voice': false
};

var bld = new messageBuilder();

var getCommand = function () {
    prompt.get(['command'], function (err, result) {
        if ( err )
            console.log(err.Error);
        if ( result ) {
            if ( result.command === 'exit' || result.command == 'quit' )
                process.exit(1);
        }

        var handler_args = {
            'user_properties': {},
            'user_email': null,
            'user_str': result ? result.command : "",
            'user_rank': 0,
            'bot_config': config,
            'user_links': null,
            'user_strings': null,
            'conv_id': "1000",
            'bld': bld,
            'cf': nlpEndpoint,
            'cb': function(err, resp) {
                if (err) console.log(err);
                console.log(resp);

                // recurse
                getCommand();
            },
            'busy': function() {
                console.log("wait...");
            },
            'idle': function() {
                
            }
        }   

        handle_message(handler_args);
    });
}

function handle_message(handler_args) {
    try {
      if (message_handlers.followup_exists(handler_args.conv_id)) {
        message_handlers.complete_followup(handler_args);
      } else {
        message_handlers.start_classified(handler_args);
      }
    } catch (err) {
        console.log(err.message);
    }
}

getCommand();

