// Options: --free-variable-checker --require --validate
/*global module require*/

const {def} = require('./sesshim.js');

module.exports = (function(){
  "use strict";

  function binary(left,rights) {
    return rights.reduce((prev,[op,right]) => [op,prev,right], left);
  }

  function qunpack(h,ms,t) {
    const result = [h];
    if (ms.length === 1) {
      const [[m,pairs]] = ms;
      result.push(m);
      for (let [q,e] of pairs) {
        result.push(q,e);
      }
    }
    result.push(t);
    return result;
  }

  return def({binary, qunpack});
}());
