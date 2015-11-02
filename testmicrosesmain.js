// Options: --free-variable-checker --require --validate
/*global module require*/

/**
 * Note that this test is a .js file written in ES5.
 */
module.exports = (function(){
  "use strict";

  require('babel');
  require('babel/register');

  var sesshim = require('./src/sesshim.es6');
  var def = sesshim.def;
  var microsesMod = require('./test/microses/microses.es6');
  var microses = microsesMod.microses;

  console.log('----------');
  const ast = microses`2+3;`;
  console.log(JSON.stringify(ast));

  return def({});
}());
