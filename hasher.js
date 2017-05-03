var scrypt = require("scrypt");
var fs = require('fs');
var path = require('path');

var configFilePath = path.join(__dirname, 'config.txt');
var salt;
fs.readFile(configFilePath, {encoding: 'utf-8'}, function(err,data){
    if (!err){
    salt = new Buffer(data);
    } else {
        console.log(err);
    }
});
var hashOutputLength = 128;
var scryptParameters;
var maxTime = 0.1;// seconds
try {
  scryptParameters = scrypt.paramsSync(maxTime);
} catch(err) {
  console.log('scryptParameters error: ' + err);
}

exports.hashAccountInfo = (info) => {
  scryptParameters = {"N":16,"r":1,"p":1};
  let result = scrypt.hashSync(info, scryptParameters, hashOutputLength, salt).toString();
  return result;
}
