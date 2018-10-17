// Options: --free-variable-checker --require --validate
/*global module require*/

const {def} = require('./sesshim.js');

module.exports = (function(){
  "use strict";

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

  function qrepack(parts) {
    // TODO bug: We only provide the raw form at this time. I
    // apologize once again for allowing a cooked form into the
    // standard.
    const raw = [parts[0]];
    const argExprs = [];
    const len = parts.length;
    for (let i = 1; i < len; i += 2) {
      argExprs.push(parts[i]);
      raw.push(parts[i+1]);
    }
    const template = def({raw});
    return [['data', template], ...argExprs];
  }

  return def({qunpack, qrepack});
}());
