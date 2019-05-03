////////////////////////////////////////////////////////////////////////////
// Replaces paranmeter instances of variables in a strng with their values
function parameterize_string(str, params) {
  var retStr = str;
  // If a variable exists, replace params in SOQL with input params
  for (var i = 0; i<params.length; i++) {
      if ( retStr.indexOf(params[i].name) >= 0 )
        //retStr = retStr.replace(params[i].name, params[i].value);
        retStr = retStr.split(params[i].name).join(params[i].value);
  }
  return retStr;
}

////////////////////////////////////////////////////////////////////////////
// Replaces paranmeter instances of variables in an object with their values
function parameterize_object(obj, params) {
  var retObj = {};
  for (var key in obj) {
    retObj[key] = parameterize_string(obj[key], params);
  }
  return retObj;
}

////////////////////////////////////////////////////////////////////////////
// Convert camel case to title
function camel_case_to_title_case(camelCase){
  if (camelCase == null || camelCase == "") {
    return camelCase;
  }

  camelCase = camelCase.trim();
  var newText = "";
  for (var i = 0; i < camelCase.length; i++) {
    if (/[A-Z]/.test(camelCase[i])
        && i != 0
        && /[a-z]/.test(camelCase[i-1])) {
      newText += " ";
    }
    if (i == 0 && /[a-z]/.test(camelCase[i]))
    {
      newText += camelCase[i].toUpperCase();
    } else {
      newText += camelCase[i];
    }
  }

  return newText;
}

module.exports.parameterize_string = parameterize_string;
module.exports.parameterize_object = parameterize_object;
module.exports.camel_case_to_title_case = camel_case_to_title_case;
