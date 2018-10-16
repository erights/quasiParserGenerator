// Options: --free-variable-checker --require --validate
/*global module require*/

module.exports = (function(){
  "use strict";

  const {def} = require('./src/sesshim.js');
  const {json} = require('./test/jessie/quasi-json.js');

  console.log('----------');
  let ast = json`[{"a": 5}, 88]`;
  console.log(JSON.stringify(ast));

  const {interpJSON} = require('./test/jessie/interp-json.js');

  const val = interpJSON(ast);
  console.log(JSON.stringify(val));

  return def({});
}());
