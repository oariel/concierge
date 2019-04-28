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
module.exports.camel_case_to_title_case = camel_case_to_title_case;
