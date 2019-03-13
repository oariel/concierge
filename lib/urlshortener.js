/*jshint node:true */
/*jshint esversion: 6 */
"use strict";


const strGoogleAPIKey = "AIzaSyDnSIx6n0sCdlZltY_oSlWq-fdX4eDM28A";

var path = require("path");
var request = require('then-request');
var logger = require(path.resolve(__dirname, './logger.js'));

// Shorten a URL using Google
function getShortUrl(longUrl, cb) {
    var str = "";
    var postdata = {
        'json': {
            'longUrl': longUrl
        }
    };
    try {
        request('POST', 'https://www.googleapis.com/urlshortener/v1/url?key=' + strGoogleAPIKey, postdata).done(function (res) {
            var shortUrl = JSON.parse(res.getBody('utf8'));
            cb(null, shortUrl);
        });
    } catch (e) {
        logger.e("Error shortening URL (" + longUrl + "): " + e.statusCode);
        return cb(e, {
            'id': longUrl
        });
    }
}



module.exports.shorten = getShortUrl;
