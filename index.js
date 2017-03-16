var express = require('express');
var app = express();
var bodyParser = require('body-parser');

var categorization = require('./categorization');

var jsonParser = bodyParser.json();

app.set('port', (process.env.PORT || 8081));

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
  res.send({status: 'OK'});
})

var server = app.listen(app.get('port'), function () {
  let host = server.address().address;
  let port = server.address().port;
  console.log("Example app listening at http://%s:%s", host, port);
})
