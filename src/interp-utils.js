// Options: --free-variable-checker --require --validate
/*global module require*/

const {def} = require('./sesshim.js');

module.exports = (function(){
  "use strict";

  class Panic extends Error {}

  function assert(flag, str) {
    if (!flag) { throw new Panic(str); }
  }

  const uninitialized = def({});

  function visit(ast, visitor) {
    if (Array.isArray(ast)) {
      if (typeof ast[0] === 'string') {
        const [kind, ...body] = ast;
        if (kind in visitor) {
          return visitor[kind](ast, ...body);
        }
        assert('visitAst' in visitor, `unrecognized ast kind ${kind}`);
        return visitor.visitAst(ast);
      }
      assert('visitAsts' in visitor, `ast list mistaken for ast ${typeof ast}`);
      return visitor.visitAsts(ast);
    }
    assert(ast !== Object(ast), `primitive data expected ${typeof ast}`);
    assert('visitData' in visitor, `unrecognized: ast ${typeof ast} ${ast}`);
    return visitor.visitData(ast);
  }


  class ReplaceVisitor {
    visitAst([kind, ...body]) {
      return [kind, ...body.map(e => visit(e, this))];
    }
    visitAsts(asts) {
      return asts.map(ast => visit(ast, this));
    }
    visitData(data) {
      return data;
    }
  }

  function binary(left,rights) {
    return rights.reduce((prev,[op,right]) => [op,prev,right], left);
  }

  return def({
    Panic, assert, uninitialized, visit, ReplaceVisitor, binary
  });
}());
