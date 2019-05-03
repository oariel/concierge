//  Plugin to receive an input
var path = require("path");
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var dateFormat = require('dateformat');
var moment = require('moment-timezone');


function containsMonth(input) {
   var months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
   var str = input.toLowerCase();
   for ( var i=0; i<months.length; i++) {
        if ( str.includes(months[i]) )
          return i;
   }
   return -1;
}

function containsDay(input) {
   var days = ["sunday", "monday","tuesday","wednesday","thursday", "friday","saturday"];
   var str = input.toLowerCase();
   for ( var i=0; i<days.length; i++) {
        if ( str.includes(days[i]) )
          return i;
   }
   return -1;
}

function containsDateDirective(input) {
   if ( containsDay(input) > -1)
      return true;
   var literals = ["today", "day after tomorrow", "tomorrow", "week from now"];
   var str = input.toLowerCase();
   for ( var i=0; i<literals.length; i++) {
        if ( str.includes(literals[i]) )
          return true;
   }
   return false;
}

function dateFromDirective(input, tzId) {
  var d = new Date();

  if ( input.includes("today") )
    d.setDate(d.getDate());
  else
  if ( input.includes("day after tomorrow") )
    d.setDate(d.getDate() + 2);
  else
  if ( input.includes("tomorrow") ) {
    d.setDate(d.getDate() + 1);
  }
  else
  if ( input.includes("week from now") )
    d.setDate(d.getDate() + 7);
  else {
    var dayINeed = containsDay(input);
    if (dayINeed > -1) {
       var diff = d.getDay() - dayINeed;
       if (diff > 0) {
         d.setDate(d.getDate() + 6);
       }
       else if (diff < 0) {
         d.setDate(d.getDate() + ((-1) * diff))
       }
    }
  }

  if (tzId) {
      var utcTime = moment(d).utc();
      var cTime = utcTime.clone().tz(tzId);
      logger.log("After conversion to " + tzId + ": " + cTime.format('MM/DD/YYYY'));
      return cTime.format('MM/DD/YYYY');
  }

  return dateFormat(d, "mm/dd/yyyy");
}

// See: https://www.npmjs.com/package/validator for validator syntax
var validator = require('validator');

var getinput = {
    'names': ['getinput', 'input'],
    'fn': function(args, cb) {

        try {
          // Adda the input to the variable list
          var param = args.user_params;

          logger.d('Plugin: getinput (' + param + ')');

          // get the variable to gather the input to
          var variable_name = args.data.variable_name;
          if ( variable_name.length == 0 ) {
            args.bld.text("Variable not defined").linebreak();
            return cb('err', args);
          }


          // Skip phrases provided?
          if ( args.data.hasOwnProperty("skip_phrases") ) {
            for ( var i = 0; i<args.data.skip_phrases.length; i++ ) {
                if ( param.toLowerCase() == args.data.skip_phrases[i].toLowerCase() ) {
                  logger.log("Skip phrase found: " + args.data.skip_phrases[i].toLowerCase())
                  param = "";
                }
            }
          }
          else
          if ( args.data.hasOwnProperty("default") )
              param = args.data.default;

          // validate the input using the optional validator
          var format = args.data.validator;

          if ( param && format ) {

            // date provided in free text format
            if ( (format.fn.indexOf("toDate") != -1) && ( (containsMonth(param) > -1 ) || containsDateDirective(param) ) ) {
                var str = param;

                // Get the Timezone variable
                var tzId = "";
                for (var i = 0; i<args.variables.length; i++) {
                    if ( args.variables[i].name == "@TimeZoneId" )
                      tzId = args.variables[i].value;
                }

                if ( containsDateDirective(param) ) {
                  param = dateFromDirective(param.toLowerCase(), tzId);
                }
                else {
                  // Year not specified - default to current year
                  if ( str.indexOf("201") == -1 ) {
                      var d = new Date();
                      str += " " + d.getFullYear().toString();
                  }

                  // Get rid of any number extensions and fillers
                  str = str.replace("rd", "");
                  str = str.replace("th", "");
                  str = str.replace("nd", "");
                  str = str.replace("st", "");
                  str = str.replace("of", "");
                  str = str.replace("the", "");
                  str = str.replace("on", "");

                  // Normalize to a format we know
                  param = dateFormat(str, "mm/dd/yyyy");

                }
            }

            // required for the code evaluation
            var x = param;

            if ( !eval(format.fn) ) {
                logger.log("Input validation " + format.fn + " failed. Expected: " + format.expect + "), Got: " + param);
                if ( args.data.hasOwnProperty("id") ) {
                  logger.log("getinput: NEXT_STEP = " + args.data.id);
                  args.bld.text("Sorry, but the expected input format is " + format.expect + ".").linebreak();
                  args.next_step = args.data.id;
                  return cb(null, args);
                }
                else
                  throw new Error("Sorry, but the expected input format is " + format.expect + ".");
            }
          }

          // Store into variable
          args.variables.push( {name: variable_name, value: param} );
          
          return cb(null, args);
        }
        catch (err) {
          logger.e(err.message);
          args.bld.text(err.message).linebreak();
          return cb(err, args);
        }
    },
};

module.exports = getinput;
