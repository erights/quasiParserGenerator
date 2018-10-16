// Options: --free-variable-checker --require --validate
/*global module require*/

module.exports = (function(){
  "use strict";

  const {def} = require('./src/sesshim.js');
  const {jester} = require('./test/jessie/quasi-jester.js');

  console.log('----------');
  let ast = jester`[{"a": 5, ...ra}, x.f + y[+i], ...r]`;
  console.log(JSON.stringify(ast));

  const {interpJester} = require('./test/jessie/interp-jester.js');

  const val = interpJester(ast, {
    x: {f: 6},
    y: [8, 7],
    i: 1,
    ra: {q: 'c', r: 'd'},
    r: ['a', 'b']
  });
  console.log(JSON.stringify(val));

  return def({});
}());
