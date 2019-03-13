////////////////////////////////////////////////////////////////////////////
// Replaces paranmeter instances of variables in a strng with their values
function parameterize_string(str, params) {
  var retStr = str;
  // If a variable exists, replace params in SOQL with input params
  for (var i = 0; i<params.length; i++) {
      if ( retStr.indexOf(params[i].name) >= 0 )
        retStr = retStr.replace(params[i].name, params[i].value);
  }
  return retStr;
}

module.exports.parameterize_string = parameterize_string;
