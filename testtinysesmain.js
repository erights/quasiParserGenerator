// Options: --free-variable-checker --require --validate
/*global module require*/

/**
 * Note that this test is a .js file written in ES5.
 */
module.exports = (function(){
  "use strict";

  var sesshim = require('./src/sesshim.js');
  var def = sesshim.def;
  var tinysesMod = require('./test/tinyses/tinyses.js');
  var tinyses = tinysesMod.tinyses;

  console.log('----------');
  var ast = tinyses`2+3;`;
  console.log(JSON.stringify(ast));

  return def({});
}());
