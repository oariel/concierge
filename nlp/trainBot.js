/* jshint esversion: 6 */

//////////////////////////////////////////////////////////////////////////////
// Bot Training Module
// Copyright Oren Ariel 2019
//
var fs = require('fs');
var natural = require('natural');
var argv = require('minimist')(process.argv.slice(2));
var path = require('path');

var phrases = [];
var categories = [];

var loadTrainingData = function(cfSubdir) {
    var td = [];

    var training_dir = path.join(__dirname, cfSubdir + 'training_data');
    fs.readdirSync(training_dir).forEach(function(file) {
        if (file.match(/\.json$/)) {
            if ( argv.v ) console.log('file: ' + file);
            var abspath = path.join(training_dir, file);
            var ntd = require(abspath);
            for (var i = 0; i < ntd.length; i++) {
                td.push(ntd[i]);
            }
        }
    });
    return td;
};

var welcome_msg =
    `
----------------------------------------------------
         Chat Bot Training Utility
        Copyright(c) Oren Ariel, Inc. 2019
        Elements Copywrite LBNL 2016
       Use -h or --help for argument list
----------------------------------------------------`;

if ( argv.v ) console.log(welcome_msg);


if (argv.h !== undefined || argv.help !== undefined) {
    console.log("Usage: node trainBot.js <options>");
    console.log("         -v : Enable debug logging");
    console.log("         -c : Classifier Subdirectory");
    process.exit();
}

classifier = new natural.LogisticRegressionClassifier();

classifier.events.on('trainedWithDocument', function(obj) {
/*
    if (argv.v !== undefined)
        console.log(obj);
*/
});

// About the bot
var cfSubdir = argv.c + '/';
if ( argv.v ) console.log("Classifier subdirectory: " + cfSubdir);

var training_data = loadTrainingData(cfSubdir);

for (var i = 0; i < training_data.length; i++) {
    var item = training_data[i];
    var fn_str = JSON.stringify(item.fdata);
    var phraseItems = [];
    var category = item.fdata.hasOwnProperty('category') ? item.fdata.category : "Other";
    for (var j = 0; j < item.phrases.length; j++) {
        classifier.addDocument(item.phrases[j], fn_str);
        var exclude = item.fdata.hasOwnProperty('exclude_from_help') && item.fdata.exclude_from_help;
        if (!exclude)
            phraseItems.push( item.phrases[j] );
    }
    if ( phraseItems.length > 0 ) {
      phrases.push( new Object( { category: category, phrases: phraseItems } ));
      if ( categories.indexOf(category) == -1 )
          categories.push(category);
    }
}


// Test training
classifier.train();

var training_dir = path.join(__dirname, cfSubdir);

classifier.save(training_dir + '/classifier.json', function(err, classifier) {
    // the classifier is saved to the classifier.json file!
});

var file = fs.createWriteStream(training_dir + '/phrases.json');
file.on('error', function(err) {
    if ( argv.v ) console.log(err);
    process.exit();
});
file.write(JSON.stringify(phrases, null, 4));
file.end();

file = fs.createWriteStream(training_dir + '/categories.json');
file.on('error', function(err) {
    if ( argv.v ) console.log(err);
    process.exit();
});
file.write(JSON.stringify(categories, null, 4));
file.end();
