// Options: --free-variable-checker --require --validate
/*global module require*/

module.exports = (function(){
  "use strict";

  const {def} = require('./src/sesshim.js');
  const {tinyses} = require('./test/tinyses/tinyses.js');

  console.log('----------');
  const ast = tinyses`2+ii;`;
  console.log(JSON.stringify(ast));

  const {interp} = require('./test/tinyses/interp.js');

  const val = interp(ast, {ii: 3});
  console.log(val);

  return def({});
}());
