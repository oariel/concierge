/*jshint esversion: 6 */
/*jshint node: true */
"use strict";

var path = require("path");
var logger = require(path.resolve(__dirname, './logger.js'));
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');

const collection = "credentials";

var credsDB = null;

// Connection attributes
var url = 'mongodb://0.0.0.0:27017';
if ( process.env.mongodb_host )
    url = process.env.mongodb_host;

var mdb_options = {
  useNewUrlParser: true
};

// Connect
MongoClient.connect(url, mdb_options, function(err, database) {
  if (err)
    return logger.e(err.message);

  logger.d('Connected to MongoDB ' + url);
  credsDB = database.db(collection);;

  // Create collection
  credsDB.createCollection(collection, function(err, res) {
    if (err)
        throw err;
    logger.log("Collection " + collection + " created!");
  });  
});


var fns = {};

fns.add = function (credentialsItem, cb) {

  if ( !credsDB )
    return;

  // remove previous alert
  credsDB.collection(collection).deleteOne({email: credentialsItem.email, label: credentialsItem.label}, function(err, ret) {
      if (err) {
        return logger.e(err.message);
        cb(err);
      }
      logger.d( ret.result.n + ' record deleted');
      // insert new alert
      credsDB.collection(collection).insertOne(credentialsItem, function(err, ret) {
          if (err) {
            return logger.e(err.message);
            cb(err);
          }
          logger.d( ret.result.n + ' record inserted');
          cb(null);
      });
  });


}

fns.find = function (email, label, cb) {

  var pattern = {};
  // You can find with a label or without
  if ( label )
      pattern = {email: email, label: label};
  else
      pattern = {email: email};
  credsDB.collection(collection).find(pattern).toArray(function(err, docs) {
      if (docs.length)
        cb(docs);
      else
        cb(null)
  });
}

fns.delete = function (email, label, cb) {

  credsDB.collection(collection).remove({email: email, label: label}, function(err, result) {
    if (err) {
      return logger.e(err.message);
      cb(err);
    }
    logger.d( result.n + ' record deleted');
    cb(null);
  });
}

module.exports = fns;
