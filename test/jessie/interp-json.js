/*global module require Q */

// Base interpreter for the asts from quasi-json.js. To be extended
// into interpreters for the asts from the grammars that extent that
// grammar.

module.exports = (function() {
  "use strict";

  const {def} = require('../../src/sesshim.js');

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

  function interpJSON(ast, env) {
    return new InterpJSONVisitor(env).i(ast);
  }

  class InterpJSONVisitor {
    constructor(env) {
      this.env = env;
    }
    i(ast) {
      return visit(ast, this);
    }
    all(args) {
      const result = [];
      args.forEach(arg => {
        if (typeof arg === 'object' && arg[0] === 'spread') {
          result.push(...this.i(arg[1]));
        } else {
          result.push(this.i(arg));
        }
      });
      return result;
    }
    data(_, value) {
      return value;
    }
    array(_, args) {
      return this.all(args);
    }
    record(_, props) {
      const result = {};
      props.map(prop => visit(prop, {
        // An arrow function to capture lexical this
        prop: (_, key,val) => { result[this.i(key)] = this.i(val); }
      }));
      return result;
    }
  }

  return def({interpJSON});
}());
