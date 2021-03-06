var hbs = require('hbs');
var moment = require('moment');
var assert = require('assert');
var Datastore = require('nedb');
var express = require('express');
var pubsub = require('./pubsub');
var bodyParser = require('body-parser');

// Load data
var dataDB = require('./data');
var devicesDB = require('./devices');

// Set up the server.
var app = express();

pubsub.attachHttpServer(app);

app.set('view engine', 'hbs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('static'));

hbs.registerHelper('json', function(context) {
    return JSON.stringify(context);
});

hbs.registerHelper('if_eq', function(a, b, opts) {
  if(a == b)
      return opts.fn(this);
  else
      return opts.inverse(this);
});

hbs.registerHelper('convert_unix', function(item, format) {
  return moment.unix(item).format(format);
});

app.post('/', function (req, res) {
  console.log(req.body);

  var device = req.body.device;
  var value = req.body.value;
  var sensor = req.body.sensor;
  var date = Math.floor(Date.now() / 1000);

  data.insert({
    sensor: sensor,
    value: value,
    date: date,
    device: device,
  });

  res.send('OK');
});

app.get('/', function (req, res) {
  devicesDB.find({}, function(error, docs) {
    docs.map((doc) => {
      doc.online = (moment().unix() < doc.last_ping + 600)
      return doc;
    });
    res.render('dashboard', { devices: docs });
  });
});

app.get('/device/:id', function (req, res) {
  var deviceId = req.params.id;
  var now = moment().unix();
  var lastWeek = moment().subtract(1, 'week').unix();

  devicesDB.findOne({ _id: deviceId }, function(error, device) {
    if(!device) return res.send('404');

    dataDB.find({ 'date': { $gte: lastWeek }, 'device': deviceId }).sort({'date': 1, 'sensor': 1}).exec(function(error, data) {
      res.render('device', { device, data });
    });
  });
});

app.get('/device/:id/raw', function (req, res) {
  var last = moment().subtract(4, 'hour').unix();

  dataDB.find({}).sort({'date': 1}).limit(25).exec(function(error, docs) {
    res.render('raw', { data: docs });
  });
});

app.listen(3000, function () {
  console.log('Server listening on port 3000');
});
