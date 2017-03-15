var express = require('express');
var app = express();
var bodyParser = require('body-parser');

var categorization = require('./categorization');

var jsonParser = bodyParser.json();

app.post('/', jsonParser, function (req, res) {
  console.log(req.body);
  // let response = {hello: 'Hello World!'};
  categorization.categorizeTransactions(req.body, (categories) => {
    res.send(JSON.stringify(categories));
  });
})

app.post('/new-categorized-transaction', jsonParser, function (req, res) {
  console.log(req.body);
  categorization.addCategorization(req.body);
})

var server = app.listen(8081, function () {
  let host = server.address().address;
  let port = server.address().port;
  console.log("Example app listening at http://%s:%s", host, port);
})
