"use strict";

var express = require('express');
var bodyParser = require('body-parser');
var path = require("path");
var argv = require('minimist')(process.argv.slice(2));
var fs = require('fs');
var logger = require(path.resolve(__dirname, "../lib/logger.js"));
var Classifier = require(path.resolve(__dirname, "./classifier.js"));
var spawn = require('child_process').spawn;
var app = express();

// default listen port
const DEFAULT_LISTEN_PORT = 2197;

var isBusy = false;

var listTrainingFiles = function(subdir) {
    var td = [];
    var training_dir = path.join(__dirname, subdir + '/training_data');
    fs.readdirSync(training_dir).forEach(function(file) {
        if (file.match(/\.json$/)) {
            logger.log('file: ' + file);
            td.push(file);
        }
    });
    return td;
};

var welcome_msg =
    `
-------------------------------------
 NLP Natural Classification Service
 Copyright(c) Capriza, Inc. 2016
 Use -h or --help for argument list
-------------------------------------`;

console.log(welcome_msg);

if (argv.h !== undefined || argv.help !== undefined || !argv.c) {
    console.log("Usage: node nlpsvc.js -c Classification Directory <options>");
    console.log("Options  -p : Listen Port (default: " + DEFAULT_LISTEN_PORT + ")");
    process.exit();
}

// Load classifier
var dir = path.resolve(__dirname);
var cfSubdir = argv.c;
if ( cfSubdir )
  dir += "/" + cfSubdir;
else {
  console.log("Invalid classifier directory.")
  process.exit(1);
}

var listenPort = DEFAULT_LISTEN_PORT;
if ( argv.p != undefined )
  listenPort = argv.p;

logger.log("Classifier directory: " + dir);
logger.log("Listen Port: " + listenPort);

// Load classifications
var cf = new Classifier();
cf.reload(dir, function(msg) {
    logger.log(msg);
});

app.use(bodyParser.json());
app.use('/editor', express.static(path.join(__dirname, 'editor')));
app.use('/' + cfSubdir , express.static(path.join(__dirname, cfSubdir)));
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Access-Control-Allow-Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/list', function (req, res) {
  try {
    logger.log("/list");
    var files = listTrainingFiles(cfSubdir);
    res.end(JSON.stringify(files));
  } catch(err) {
      logger.e(err.message);
      res.end(JSON.stringify(err));
  }

});

app.get('/remove:id', function (req, res) {
  try {
    logger.log("/remove");
    var filePath = path.join(__dirname, cfSubdir + '/training_data/') + req.params.id;
    fs.unlinkSync(filePath);
    res.end(JSON.stringify({value: 0, message:req.params.id + " removed."}));
  } catch(err) {
      logger.e(err.message);
      res.end(JSON.stringify(err));
  }
});

app.get('/info', function (req, res) {
  try {
    logger.log("/info");
    var info = {
        root: cfSubdir,
        path: cfSubdir + '/training_data',
        fullPath: path.join(__dirname, cfSubdir + '/training_data')
    }
    res.end(JSON.stringify(info));
  } catch(err) {
      logger.e(err.message);
      res.end(JSON.stringify(err));
  }
});

app.put('/save/:id', function(req, res){
  try {
    logger.log("/save")
    if ( !req.params.id )
        return res.send({value:-1, message:"File name not specified"});

    var training_dir = path.join(__dirname, cfSubdir + '/training_data');
    var fname = training_dir + '/' + req.params.id;

    logger.log("saving to " + req.params.id);
    var file = fs.createWriteStream(fname);
    file.on('error', function(err) {
        logger.e(err);
        return res.end(JSON.stringify(err));
    });
    file.write(JSON.stringify(req.body, null, 4));
    file.end();
    res.end(JSON.stringify({value: 0, message:"Save complete."}));
  } catch(err) {
      logger.e(err.message);
      res.end(JSON.stringify(err));
  }
});

// Must run training as a separate process because natural is a singleton
app.get('/train', function (req, res) {

  logger.log("/train");
  isBusy = true;

  var prc = spawn('node', [path.join(__dirname + '/trainBot'), '-c', cfSubdir]);
  prc.stdout.setEncoding('utf8');
  prc.stdout.on('data', function (data) {
      var str = data.toString()
      var lines = str.split(/(\r?\n)/g);
      logger.log(lines.join(""));
  });

  prc.on('close', function (code) {
      if ( code == 0 ) {
        logger.log('Training complete.');
        cf.reload(dir, function(msg) {
            logger.log(msg);
            // Give it another 15 seconds to wind down
            setInterval(function() {
              isBusy = false;
            }, 15*1000);
        });
        res.end(JSON.stringify({message:"Training complete."}));
      }
      else {
        logger.log('Training failed (exit code: ' + code + ')');
        res.end(JSON.stringify({message:"Training failed (exit code: " + code + ")"}));
        isBusy = false;
      }
  });

});

app.get('/bestmatch/:phrase', function (req, res) {
  try {
    logger.log("/bestmatch");
    var phrase = req.params.phrase;
    logger.log("Best Match request: Phrase = '" + phrase);
    var bestMatch = cf.bestMatch(phrase);
    res.end(JSON.stringify(bestMatch));
  } catch(err) {
      logger.e(err.message);
      res.end(JSON.stringify(err));
  }
});

// Classify command
app.get('/classify/:phrase/:rank', function (req, res) {
  try {
    logger.log("/classify")
    var phrase = req.params.phrase;
    var rank = parseInt(req.params.rank);
    logger.log("Classification request: Phrase = '" + phrase + '\' Rank = ' + rank );

    // Classify
    var cfRes = cf.doClassification(phrase, rank);
    cfRes['dictionary'] = cfSubdir; // for analytics purpose
    logger.d('Result: ' + cfRes.command + ',' + cfRes.param + ',' + (100*cfRes.score).toFixed(1) + '%');

    // Return Result
    res.end(JSON.stringify(cfRes));
  } catch(err) {
      logger.e(err.message);
      res.end(JSON.stringify(err));
  }
})

// Is busy
app.get('/isbusy', function (req, res) {
  try {
    logger.log("/isbusy");
    if ( isBusy )
      logger.log("Classifier is currently busy. ");
    res.end(JSON.stringify(isBusy));
  } catch(err) {
      logger.e(err.message);
      res.end(JSON.stringify(err));
  }
})

// Classify command
app.get('/categories', function (req, res) {
  try {
    logger.log("/categories");
    var categories = cf.getCategories();
    res.end(JSON.stringify(categories));
  } catch(err) {
      logger.e(err.message);
      res.end(JSON.stringify(err));
  }
})

// Classify command
app.get('/phrases', function (req, res) {
  try {
    logger.log("/phrases");
    var phrases = cf.getPhrases();
    res.end(JSON.stringify(phrases));
  } catch(err) {
      logger.e(err.message);
      res.end(JSON.stringify(err));
  }
})

// Start server
var server = app.listen(listenPort, function () {
  var host = server.address().address;
  if ( host == "::")
    host = "0.0.0.0";
  var port = server.address().port;
  logger.log("NLP Service listening at http://" + host + ":" + port)
})
