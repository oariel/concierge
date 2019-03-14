"use strict";

const FOLLOWUP_TIMEOUT = 180; // Seconds

var path = require("path");
var request = require('then-request');
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var plugins = require(path.resolve(__dirname, "./find_plugins.js"));

//var events = require(path.resolve(__dirname, './events_mdb.js'));

var fns = {};
var followups = {};
var lingeringFollowups = {};
var history = {};

function getBuiltinVariables(args) {
  var vars = [];

  // User identity variables
  if (args.hasOwnProperty("user_email") && args.user_email)
      vars.push({name: "@UserEmail", value: args.user_email});

  // Device location variables
  if (args.hasOwnProperty("device_location") && args.device_location) {
      vars.push({name: "@CoordinatesLon", value: args.device_location.lon});
      vars.push({name: "@CoordinatesLat", value: args.device_location.lat});
      vars.push({name: "@Address", value: args.device_location.address});
      vars.push({name: "@ZipCode", value: args.device_location.zipCode});
      vars.push({name: "@City", value: args.device_location.city});
      vars.push({name: "@Country", value: args.device_location.country});
      vars.push({name: "@TimeZoneName", value: args.device_location.tz_name});
      vars.push({name: "@TimeZoneId", value: args.device_location.tz_id});
  }

  return vars;
}

fns.get_lingering_followup = function(conv_id) {
    return lingeringFollowups[conv_id];
}

fns.get_lingering_followups = function() {
    return lingeringFollowups;
};

fns.abort_lingering_followup = function(conv_id) {
    delete lingeringFollowups[conv_id];
}

fns.have_plugin = function(user_str) {
    var chunks = user_str.split(/\s/);
    var cmd = chunks[0].toLowerCase();
    return plugins.hasOwnProperty(cmd);
};

fns.has_history = function(conv_id) {
    return history[conv_id] != undefined;
}

fns.get_history = function(conv_id) {
    return history[conv_id] ? history[conv_id].user_str : "";
}

fns.clear_history = function(conv_id) {
    delete history[conv_id];
}

fns.is_last_step = function(conv_id) {
    return !followups[conv_id] || (followups[conv_id].current_step+1 > followups[conv_id].steps.length);
}

function do_expire_followups(followups, timeout) {

    var t = FOLLOWUP_TIMEOUT;
    if ( timeout )
        t = timeout;

    // Expire old followup items
    var followup_keys = Object.keys(followups);
    var now = Math.floor(Date.now() / 1000);
    for (var i = 0; i < followup_keys.length; i++) {
        var conv_id = followup_keys[i];
        if (now - followups[conv_id].timestamp > t) {
            logger.log("Expiring key for conv id: " + conv_id);
            delete followups[conv_id];
        }
    }
}


fns.expire_followups = function(timeout) {
  do_expire_followups(followups, timeout);
  do_expire_followups(lingeringFollowups, timeout);
}



fns.get_followup = function(conv_id) {
    return followups[conv_id];
}

fns.abort_followup = function(conv_id) {
    delete followups[conv_id];
}

fns.followup_exists = function(id) {
  return followups.hasOwnProperty(id);
}

fns.next_followup = function(args) {

  // cancel?
  if ( args.user_str.toLowerCase() == args.bot_config.cancel_literal.toLowerCase() ) {
    logger.d('CANCELLED');
    delete followups[args.conv_id];
    fns.clear_history(args.conv_id);
    return args.cb(null, args.bld.text('Ok.').toSegments());
  }

  // try again?
  if ( fns.has_history(args.conv_id) && (args.user_str.toLowerCase() == args.bot_config.retry_literal.toLowerCase()) ) {
    logger.d('TRY AGAIN - CANCELLED');
    delete followups[args.conv_id];
    fns.start_classified(args);
    return;
  }

  try {
    var conv_id = args.conv_id;
    var fup = followups[conv_id];
    if (fup === undefined) {
        return args.cb(null, args.bld.text('Action doesn\'t exist anymore or has expired').toSegments());
    }

    // Next step
    followups[conv_id].current_step++;

    // Followup complete?
    if ( followups[conv_id].current_step >= followups[conv_id].steps.length ) {
      logger.d('FOLLOWUP COMPLETE');

      // With background runs (which sets the linger flag) we want to keep the followup until it expires
      if (!followups[conv_id].linger)
        delete followups[conv_id];
      else {
        logger.log("Followup will linger");
        lingeringFollowups[conv_id] = followups[conv_id];
        delete followups[conv_id];
      }
    }
    // More steps? - Prompt next step
    else {
      logger.d('NEXT FOLLOWUP STEP');
      var n = followups[conv_id].current_step + 1;
      var curr_step = followups[conv_id].steps[n-1];

      if ( curr_step.topic.hasOwnProperty('name') )
        args.bld
            //.text("Step " + n + " of " + followups[conv_id].steps.length + ": ")
            .bold(curr_step.topic.name).linebreak();

      // Stop supporting retries after two steps
      if ( fns.has_history(args.conv_id ) ) {
        history[args.conv_id].counter = history[args.conv_id].counter + 1;
        if ( history[args.conv_id].counter > 2 ) {
          fns.clear_history(args.conv_id);
        }
      }

      // Is there a step result from the previous step?
      var step_result = (n-2>=0) ? followups[conv_id].steps[n-2].step_result : null;

      if ( step_result && step_result.length > 0 ) {
          var str = "Select one of the following options";
          if ( curr_step.topic.hasOwnProperty('followup') )
            str = curr_step.topic.followup;

          // For message builders frameworks which don't support buttons
          if ( !args.bld.hasButtons() ) {
              if ( n > 1 ) args.bld.linebreak();
              args.bld.text(str).cancel(" (or say '" + args.bot_config.cancel_literal + "')", conv_id).linebreak();
              for ( var i=0; i<step_result.length; i++) {
                  if ( args.bot_config.has_voice )
                      args.bld.text("Say ").bold((i+1).toString()).text(" for " + step_result[i].name).linebreak();
                  else
                      args.bld.ident().bold((i+1).toString()).text(" - " + step_result[i].name).linebreak();
              }
              return false;
          }
          // Slack, etc
          else {
              args.bld.attachAction(str, conv_id, "good");
              var type = (step_result.length > 4) ? "select" : "button";
              for ( var i=0; i<step_result.length; i++) {
                  args.bld.addActionButton( i.toString(), step_result[i].name, null, type);
              }
              if ( !followups[conv_id] || (followups[conv_id].current_step > followups[conv_id].steps.length) )
                args.bld.addActionButton( "-1", args.bot_config.cancel_literal ); // Maximum allowed buttons by slack :(
              return false;
          }
      }
      else
      if ( curr_step.topic.hasOwnProperty('followup') ) {
          args.bld.text(curr_step.topic.followup).cancel(" (or say '" + args.bot_config.cancel_literal + "')",conv_id).linebreak();
          return false;
      }
      else
          return true;
    }
  }
  catch (err) {
    console.log(err);
  }
}

fns.complete_followup = function(args, user_str) {

  try {
    // cancel?
    if ( args.user_str.toLowerCase() == args.bot_config.cancel_literal.toLowerCase() ) {
      logger.d('CANCELLED');
      delete followups[args.conv_id];
      fns.clear_history(args.conv_id);
      return args.cb(null, args.bld.text('Ok.').toSegments());
    }

    // try again?
    if ( fns.has_history(args.conv_id) && (args.user_str.toLowerCase() == args.bot_config.retry_literal.toLowerCase()) ) {
      logger.d('TRY AGAIN - CANCELLED');
      delete followups[args.conv_id];
      fns.start_classified(args);
      return;
    }

    var conv_id = args.conv_id;
    var fup = followups[conv_id];
    if (fup === undefined) {
        fns.clear_history(args.conv_id);
        return args.cb(null, args.bld.text('Action doesn\'t exist anymore or has expired').toSegments());
    }

    // set current step
    var topic = fup.steps[fup.current_step].topic;
    var n = fup.current_step + 1;

    var user_param = "";
    if ( user_str )
      user_param = user_str; // passed param
    else
      user_param = args.user_str; // param typed in chat

    // Use the result in the previous step as the input to the next step
    if ( n > 1 ) {

      var previous_step_result = fup.steps[n-2].step_result;
      if ( previous_step_result && previous_step_result.length > 0 ) {
        var index = parseInt(user_param);

        if ( isNaN(index) || index < 0 || index > previous_step_result.length ) {

          // Option doesn't have to be one of the suggestions on default, unless strict = true
          var isStrict = false;
          var prevTopic = fup.steps[fup.current_step-1].topic;
          if ( prevTopic.hasOwnProperty("strict") )
            isStrict = prevTopic.strict;

          logger.log("Strict: " + isStrict);

          // Try to find the index of the selection
          var found = false;
          for ( var i=0; i<previous_step_result.length; i++ ) {
              if ( user_param.toLowerCase() == previous_step_result[i].name.toLowerCase() ) {
                index = i+1;
                user_param = previous_step_result[index-1].value;
                found = true;
                break;
              }
          }

          // Not found
          if (!found && isStrict) {
            logger.log("Selection has to be one of the suggested options.");
            return args.cb(null, args.bld.text('Selection is not one of the suggested options. Please try again.').toSegments());
          }
        }
        else
          user_param = previous_step_result[index-1].value;
      }
    }

    logger.d('HANDLING FOLLOWUP STEP ' + n);
    logger.d('PARAM: ' + user_param);

    // Invoke plugin function
    if (topic.hasOwnProperty('fn_name')) {

        // Throw directive in a plugin causes the output of the workflow to become the input of the next workflow
        if ( topic.fn_name.toLowerCase() == "throw" ) {
            logger.log("Throw: " + user_param);
            delete followups[args.conv_id];
            fns.clear_history(args.conv_id);
            args.user_str = user_param;
            return fns.start_classified(args);
        }

        // execute step in plugin
        var fn_args = {
            'conv_id': conv_id,
            'cb': args.cb,
            'cf':args.cf,
            'bld': args.bld,
            'data': topic,
            'user_params': user_param,
            'user_properties': args.user_properties,
            'user_email': args.user_email,
            'step_result': [],
            'next_step': '',
            'variables': followups[conv_id].variables,
            'bot_config': args.bot_config,
            'linger': false,
            'workflow_name': args.workflow_name,
            'busy': function() {
              args.busy();
            },
            'idle': function() {
              args.idle();
            }
        }

        // Invoke callback
        var p_fn = plugins[topic.fn_name];
        p_fn(fn_args, function(err, ret_fn_args) {

            args.idle();

            if ( err ) {
                delete followups[args.conv_id];
                args.cb(null, args.bld.linebreak().bold("Workflow aborted.").linebreak().toSegments());
                fns.clear_history(args.conv_id);
                return;
            }

            // Just a prececaution in case the session has been terminated while the plugin was still processing
            if ( !followups[conv_id] )
              return;

            // Add to followup any variables added or modified by the plugin
            followups[conv_id].steps[fup.current_step].step_result = ret_fn_args.step_result;
            followups[conv_id].variables = ret_fn_args.variables;
            followups[conv_id].linger = ret_fn_args.linger;
            followups[conv_id].user_properties = ret_fn_args.user_properties;
            followups[conv_id].timestamp = ret_fn_args.timestamp;

            // The plugin can change the next step
            if ( ret_fn_args.next_step.length > 0 ) {
              if ( ret_fn_args.next_step == "_fin" )
                  followups[conv_id].current_step = followups[conv_id].steps.length-1;
              else
              if ( ret_fn_args.next_step == "_start" )
                  followups[conv_id].current_step = 0;
              else {
                  // find the step to skip to
                  for (var i=0; i<followups[conv_id].steps.length; i++) {
                      if ( followups[conv_id].steps[i].topic.id == ret_fn_args.next_step ) {
                          followups[conv_id].current_step = i-1;
                          break;
                      }
                  }
              }
              logger.log("PLUGIN REQUESTED STEP CHANGE: id = " + ret_fn_args.next_step + " ( #" + (followups[conv_id].current_step+1).toString() + ")");
            }

            // advance to next step
            if ( !fns.next_followup(args) )
              // next one doesn't run immediately so return
              return args.cb(null, args.bld.toSegments());
            else
              // run next one immediate in which case, recurse
              return fns.complete_followup(args);
        });

    }
  }
  catch (err) {
    console.log(err);
  }


};

function is_classifier_busy(cfHost, cb) {
    // Create new user in trial org
    try {
        var url = cfHost + '/isbusy';
        request('GET', url, {timeout:750}).done(function (rs) {
          var result = {};
          result = JSON.parse(rs.getBody('utf8'));
          cb(result, null);
        }, function (err) {
          if (err.timeout) {
              logger.e("NLP call timeout: classifier is probably busy");
              cb(true, null);
          }
          return cb (null, err);
        });

    } catch(err) {
        logger.e(err.message);
        return cb (null, err);
    }
}

function do_classification(cfHost, phrase, rank, cb) {
    if (!phrase)
      return cb(null, {message: "Empty input string - ignoring"});  
    
    try {
        logger.log("Classifying: " + phrase);
        var url = cfHost + '/classify/' + encodeURIComponent(phrase) + '/' + rank;
        request('GET', url).done(function (rs) {
          var result = {};
          result = JSON.parse(rs.getBody('utf8'));
          return cb(result, null);
        });
    } catch(err) {
        logger.e(err.message);
        return cb (null, err);
    }
}

function do_best_match(cfHost, phrase, cb) {
    try {
        var url = cfHost + '/bestmatch/' + encodeURIComponent(phrase);
        request('GET', url).done(function (rs) {
          var result = {};
          result = JSON.parse(rs.getBody('utf8'));
          return cb(result, null);
        });
    } catch(err) {
        logger.e(err.message);
        return cb (null, err);
    }
}

fns.start_classified = function(args) {

  try {

    logger.d('HANDLING NEW CLASSIFIED');

    var bRetry = (args.user_str.toLowerCase() == args.bot_config.retry_literal.toLowerCase());

    // user is not happy with the result and requests next rank
    if (bRetry) {

        logger.log('TRY AGAIN (has history = ' + fns.has_history(args.conv_id) + ')');

        // Pull the last command from history if exists (it may have been cleared along the way in one of the steps)
        if ( fns.has_history(args.conv_id) ) {
            args.user_str = history[args.conv_id].user_str;
            args.user_rank = history[args.conv_id].user_rank + 1;
        }
    }

    // Save last command in history
    var command = {
        'user_str': args.user_str,
        'user_rank': args.user_rank,
        'counter': 1
    }
    history[args.conv_id] = command;

    is_classifier_busy(args.cf, function(cfBusy, err) {

      if (cfBusy) {
        logger.e("Classifier is busy. Request rejected.");
        delete followups[args.conv_id];
        args.cb(null, args.bld.text('I\'m sorry, but I\'m currently being trained on new phrases. This doesn\'t happen very often so please try again in a couple of minutes.').toSegments());
        fns.clear_history(args.conv_id);
        return;
      }

      do_classification(args.cf, args.user_str, args.user_rank, function(cfRes, err) {

          if ( !cfRes ) {
              logger.e(err.message);
              args.cb(null, args.bld.text('I\'m sorry, but I cannot classify your input phrase (' + err.message + ')').toSegments());

          }
          else {

            var d = new Date();
            var timestamp = d.getTime();

            // Event log item
            var eventItem = {
                  timestamp: timestamp,
                  platform: args.bot_config.type,
                  conv_id: args.conv_id,
                  email: args.user_email,
                  dictionary: cfRes.dictionary,
                  phrase: args.user_str,
                  rank: args.user_rank,
                  score: (100*cfRes.score).toFixed(1)
            };

            if ( cfRes.score <= 0.5 ) {

                logger.d('CLASSIFIED IS NOT GOOD ENOUGH TO CALL');
                fns.clear_history(args.conv_id);

                // If the string is a number, this can be caused by a user pressing a button of an old command still visible on the screen
                var index = parseInt(args.user_str);
                if ( !isNaN(index) && index > -1 )
                    return args.cb(null, args.bld.text("I'm sorry, but I don't understand this command ("  + args.user_str + "). This might be an action that doesn't exist anymore or that has expired.").toSegments());

                if ( bRetry )
                    return args.cb(null, args.bld.text("I'm sorry, but I've run out of suggestions. Try saying 'help'.").toSegments());
                else {
                  is_classifier_busy(args.cf, function(cfBusy, err) {

                      if (cfBusy) {
                        logger.e("Classifier is busy. Request rejected.");
                        return args.cb(null, args.bld.text('I\'m sorry, but I\'m currently being trained on new phrases. This doesn\'t happen very often so please try again in a couple of minutes.').toSegments());
                      }

                      do_best_match(args.cf, args.user_str, function(bmRes, err) {

                        // Write to events database
                        //eventItem['type'] = 'FAIL';
                        //eventItem['bestmatch'] = bmRes.str;
                        //events.add(eventItem);

                        return args.cb(null,args.bld
                              .text("I'm sorry, but I don't understand '" + args.user_str + "'.").linebreak().linebreak()
                              .text("Did you mean ").bold("'" + bmRes.str + "'").text("? Try saying 'help'." ).linebreak()
                              .toSegments());
                      });
                  });
                  return;
                }
            }

            logger.d('HIGH CONFIDENCE CLASSIFIED COMMAND: (' + cfRes.command + ',' + cfRes.param + ',' + (100*cfRes.score).toFixed(1) + '%)');

            // Get the topic. Make sure the returning JSON is not garbage
            try {
              args.topic = JSON.parse(cfRes.label);
            }            
            catch(e) {
              return args.cb(null, args.bld.text('I\'m sorry, but I cannot classify your input phrase.').toSegments());
            }

            var fup = {
                'cb': args.cb,
                'cf':args.cf,
                'bld': args.bld,
                'user_properties': args.user_properties,
                'user_email': args.user_email,
                'conversation_id': args.conv_id,
                'timestamp': Math.floor(Date.now() / 1000),
                'current_step':0,
                'steps': [],
                'variables': getBuiltinVariables(args),
                'bot_config': args.bot_config,
                'linger': false,
                'workflow_name': args.topic.title
            };

            followups[args.conv_id] = fup;

            // Ignore the parameter if instructed so (for speech based)
            var param = cfRes.param;
            if ( args.topic.hasOwnProperty('skip_params') && (args.topic.skip_params == "true" || args.topic.skip_params == true) ) {
              logger.log('Params are ignored for this command');
              param = '';
            }

            // Push all steps for followup
            for (var i=0; i<args.topic.steps.length; i++) {
                var step = {
                    'topic': args.topic.steps[i],
                    'step_result': null
                }
                followups[args.conv_id].steps[i] = step;
            }

            // Print title if exists
            if ( args.topic.hasOwnProperty('title') ) {
              args.bld.text("Workflow: ").bold(args.topic.title).linebreak().linebreak();
              eventItem['workflow'] = args.topic.title;
            }

            // Write to events database
            //eventItem['type'] = 'SUCCESS';
            //eventItem['command'] = cfRes.command;
            //eventItem['param'] = cfRes.param;
            //events.add(eventItem);

            // Step 1 has a followup and no parameter provided
            if ( !param.length && args.topic.steps[0].hasOwnProperty('followup') ) {
                    if ( args.topic.steps[0].hasOwnProperty('name') ) {
                      // Multiple steps, so print step number
                      if ( args.topic.steps.length > 1 )
                        args.bld
                            //.text("Step 1 of " + args.topic.steps.length + ": ")
                            .bold(args.topic.steps[0].name).linebreak();
                      // There's only one step
                      else
                        args.bld.bold(args.topic.steps[0].name).linebreak();
                  }
                  args.bld.text(args.topic.steps[0].followup).cancel(" (or say '" + args.bot_config.cancel_literal + "')", args.conv_id);
                  return args.cb(null, args.bld.toSegments());
            } else {
                if ( args.topic.steps.length > 1 ) {
                  // Multiple steps, so print step number
                  if ( args.topic.steps[0].hasOwnProperty('name') ) {
                      args.bld
                          //.text("Step 1 of " + args.topic.steps.length + ": ")
                          .bold(args.topic.steps[0].name);
                      if ( param.length > 0 && args.topic.steps[0].hasOwnProperty('followup') )
                        args.bld.text(" (" + param + ")");
                      args.bld.linebreak();
                  }
                }
                else {
                  // There's only one step
                  if ( args.topic.steps[0].hasOwnProperty('name') )
                      args.bld.bold(args.topic.steps[0].name).linebreak();
                }
                fns.complete_followup(args, param);
            }
          }
      });
    });

  }
  catch (err) {
    logger.log(err);
  }
};

module.exports = fns;
