require('6to5');
require('6to5/register');

console.log('hello ' + process.argv.slice(2).join(', '));
require('./hello2.es6');
