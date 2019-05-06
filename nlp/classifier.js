//////////////////////////////////////////////////////////////////
// Natural Language Classifier object
// Copyright Oren Ariel, Inc 2019
//
var natural = require('natural');

//stemmer = natural.LancasterStemmer;
//natural.LancasterStemmer.attach();

var util = require('util');
var path = require("path");
var fs = require('fs');
var logger = require(path.resolve(__dirname, '../lib/logger.js'));
var Combinatorics = require('js-combinatorics');
var request = require('then-request');

// Get the classifier info
function nlp_info(cfHost, cb) {
    try {
        var url = cfHost + '/info';
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

function nlp_help(cfHost, query, cb) {
    var result = {};
    // Create new user in trial org
    try {
        var url = cfHost + '/' + query;
        request('GET', url).done(function (res) {
            result = JSON.parse(res.getBody('utf8'));
            return cb(result, null);
        });
    } catch(err) {
        logger.e(err.message);
        return cb (null, err);
    }
}


const MAX_WC = 5;
var uselessWords = [];

// Is a word in the useless words list?
function isUseless(s) {
    for (var i = 0; i < uselessWords.length; i++) {
        if (uselessWords[i].toLowerCase() === s.toLowerCase())
            return true;
    }
    return false;
}

// My classifier object
function myClassifier() {

  classifier = new natural.LogisticRegressionClassifier(/*stemmer*/);
  categories = [];
  phrases = [];
  lastModifyTime = new Date();

  myClassifier.prototype.getClassifier = function () {
      return classifier;
  }

  myClassifier.prototype.doClassification = function(text, idx) {

      var index = 0;
      if ( idx ) index = idx;

      // break into words
      var temp = text.match(/\b(\w+)\b/g), words = [];

      // Remove useless words
      for ( var i=0; i<temp.length; i++) {
          if ( !isUseless(temp[i]) )
              words.push(temp[i]);
      }

      // Skip extracting the parameter for too long sentences due to combinatorics hell
      // Or - if the rank requested is not the default one
      if (words.length > MAX_WC || index > 0) {
          var scores = classifier.getClassifications(text);
          return new Object(
                {
                    'command' : text,
                    'param' : '',
                    'score' : scores[Math.min(index, scores.length-1)].value,
                    'label' : scores[Math.min(index, scores.length-1)].label
                }
          );
      }

      // For short sentences, find the parameter
      var perms = Combinatorics.permutationCombination(words).toArray();

      // Find out which combination get s the highest score
      var maxScore = 0.5;
      var bestMatch = "";
      var label = "";


      //console.time("classification");

      // Find the combination with the highest score
      for ( j = 0; j<perms.length; j++) {

          var str = "";

          for ( var i = 0; i<perms[j].length; i++ ) {
              str += perms[j][i];
              if ( i<perms[j].length-1 )
                str += ' ';
          }

          // Classify
          var scores = classifier.getClassifications(str);

          // Best match?
          if ( scores.length > 0 ) {
              // Best score so far?
              if ( scores[Math.min(index, scores.length-1)].value > maxScore ) {
                  maxScore = scores[Math.min(index, scores.length-1)].value;
                  bestMatch = str;
                  label = scores[Math.min(index, scores.length-1)].label;
              }
              else
              // If the same score, prefer shorter strings
              if ( (scores[Math.min(index, scores.length-1)].value == maxScore) && (str.length < bestMatch.length) ) {
                  maxScore = scores[Math.min(index, scores.length-1)].value;
                  bestMatch = str;
                  label = scores[Math.min(index, scores.length-1)].label;
              }
          }
      }


      var params = "";

      // Find which words are NOT in the best match
      for ( var i=0; i<words.length; i++) {
          var n = bestMatch.indexOf(words[i]);
          if ( n == -1 ) {
            params += words[i];
            if ( i<words.length-1 )
                params += " ";
          }
      }

      //console.timeEnd("classification");

      return new Object(
            {
              'command' : bestMatch.trim(),
              'param' : params.trim(),
              'score' : maxScore,
              'label' : label
            }
        );

  }


  myClassifier.prototype.getPhrases = function () {
      return phrases;
  }

  myClassifier.prototype.getCategories = function () {
      return categories;
  }

  // Find closest match from the available phrases using Jaro-Winkler distance algorithm
  myClassifier.prototype.bestMatch = function(str) {
      var maxScore = 0;
      var bestMatch = '';
      for (var j=0; j<phrases.length; j++) {
          var phraseItem = phrases[j];
          for (var k=0; k<phrases[j].phrases.length; k++) {
              var score = natural.JaroWinklerDistance(str, phrases[j].phrases[k]);
              if ( score > maxScore) {
                  maxScore = score;
                  bestMatch = phrases[j].phrases[k];
              }
          }
      }
      return new Object({str: bestMatch, score: maxScore});
  }

  myClassifier.prototype.reload = function (dir, callback) {

      var fname = dir + '/classifier.json';

      // check if the classifier file has changed - if so, reload
      fs.stat(fname, function(err, stats){

        var mtime = new Date(util.inspect(stats.mtime));

        if ( mtime.getTime() != lastModifyTime.getTime() ) {

            natural.LogisticRegressionClassifier.load(dir + '/classifier.json', null, function(err, cf) {

                // First time?
                if ( classifier == null ) {
                    classifier = cf;
                    classifier.train();
                    if ( callback != null )
                        callback("Classification has been trained.");
                }
                else {
                    classifier = cf;
                    classifier.retrain();
                    if ( callback != null )
                        callback("Classification has been re-trained.");
                }

                lastModifyTime = mtime;

                // Load phrases (for help)
                fs.readFile(dir + '/phrases.json', 'utf8', function (err,data) {
                  if (err)
                      callback("Failed to read phrases. Help is not available");
                  else
                      phrases = JSON.parse(data);
                });

                // Load list of useless words
                fs.readFile(dir + '/useless.json', 'utf8', function (err,data) {
                  if (err)
                      callback("Failed to read list of useless words");
                  else
                      uselessWords = JSON.parse(data);
                });

                // Load list of useless words
                fs.readFile(dir + '/categories.json', 'utf8', function (err,data) {
                  if (err)
                      callback("Failed to read list of categories");
                  else
                      categories = JSON.parse(data);
                });

            });
        }
      });
  }
}

module.exports = myClassifier;
module.exports.nlp_help = nlp_help;
module.exports.nlp_info = nlp_info;
