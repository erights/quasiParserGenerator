// Options: --free-variable-checker --require --validate
/*global module require*/

module.exports = (function(){
  "use strict";

  const {def} = require('./src/sesshim.js');
  const {tinyses} = require('./test/tinyses/tinyses.js');

  console.log('----------');
  let ast = tinyses`22.toString(ii);`;
  console.log(JSON.stringify(ast));

  const {desugar,scope,interp} = require('./test/tinyses/interp.js');

  ast = desugar(ast);
  console.log(JSON.stringify(ast));

  ast = scope(ast);
  console.log(JSON.stringify(ast));
  
  const val = interp(ast, {ii: 3});
  console.log(val);

  return def({});
}());
