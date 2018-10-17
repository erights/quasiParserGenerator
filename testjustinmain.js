// Options: --free-variable-checker --require --validate
/*global module require*/

module.exports = (function(){
  "use strict";

  const {def} = require('./src/sesshim.js');
  const {justin} = require('./test/jessie/quasi-justin.js');

  console.log('----------');
  let ast = justin`[{"a": 5, ...ra}, x.f + y[+i], ...r]`;
  console.log(JSON.stringify(ast));

  const {interpJustin} = require('./test/jessie/interp-justin.js');

  const val = interpJustin(ast, {
    x: {f: 6},
    y: [8, 7],
    i: 1,
    ra: {q: 'c', r: 'd'},
    r: ['a', 'b']
  });
  console.log(JSON.stringify(val));

  return def({});
}());
