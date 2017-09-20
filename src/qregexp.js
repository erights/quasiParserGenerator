// Options: --free-variable-checker --require --validate
/*global module require*/

module.exports = (function(){
  "use strict";

  const {def} = require('./sesshim.js');

  // Based on
  // https://github.com/benjamingr/RexExp.escape/blob/master/polyfill.js
  // and thread beginning at
  // https://mail.mozilla.org/pipermail/es-discuss/2015-June/043201.html

  function re(first, ...args) {
    let flags = first;
    function tag(template, ...subs) {
      const parts = [];
      const numSubs = subs.length;
      for (let i = 0; i < numSubs; i++) {
        parts.push(template.raw[i]);
        const subst = subs[i] instanceof RegExp ?
            `(?:${subs[i].source})` :
            subs[i].replace(/[\/\\^$*+?.()|[\]{}]/g, '\\$&');
        parts.push(subst);
      }
      parts.push(template.raw[numSubs]);
      return RegExp(parts.join(''), flags);
    }
    if (Array.isArray(first)) {
      flags = void 0;  // Should this be '' ?
      return tag(first, ...args);
    } else {
      return tag;
    }
  }

/*
  console.log(re`^${'^$'}$`);
  const rex = re('i')`^${'^$'}$`;
  console.log(rex);
  console.log(re`${rex}|${rex}*|${'\\'}`);

  const data = ':x';
  const rebad = re`(?${data})`;
  console.log(rebad);
  console.log(rebad.test('x'));
*/

  return def({re});
}());
