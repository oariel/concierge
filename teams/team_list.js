/*jshint node:true */
/*jshint esversion: 6 */
"use strict";

const teamFileName = './teamList.js';
var util = require('util');
var path = require('path');
var fs = require('fs');
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var teamList = require(path.resolve(__dirname, teamFileName));

/////////////////////////////////////////////////
// Based on the user info, get the NLP endpoint
function get_device_nlp_endpoint(userInfo) {
    var defaultEndpoint = "";
    var domain = userInfo.email.split("@")[1];
    for ( var i=0; i<teamList.length; i++) {
        // Attach an endpoint to a specific user
        if ( teamList[i].team == userInfo.email.toLowerCase() )
          return teamList[i].endpoint;
        // Match domain
        if ( teamList[i].team == domain )
          return teamList[i].endpoint;
        // Fallback
        if ( teamList[i].team == "*" )
          defaultEndpoint = teamList[i].endpoint;
    }
    return defaultEndpoint;
}

//////////////////////////////////////////////////////////
// Reload the team list of the team list file has changed
function reload_team_list(intervalMilisec) {
    // Reload team list if it has changed
    var ago = new Date( (new Date()).getTime() - intervalMilisec);
    var stats = fs.statSync(path.resolve(__dirname, teamFileName));
    var mtime = new Date(util.inspect(stats.mtime));
    if ( mtime.getTime() >= ago ) {
        delete require.cache[path.resolve(__dirname, teamFileName)];
        teamList = require(path.resolve(__dirname, teamFileName));
        logger.log("Team list re-loaded.")
    }
}

module.exports.get_device_nlp_endpoint = get_device_nlp_endpoint;
module.exports.reload_team_list = reload_team_list;
