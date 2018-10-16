/*global module require Q */

// Base interpreter for the asts from quasi-json.js. To be extended
// into interpreters for the asts from the grammars that extent that
// grammar.

module.exports = (function() {
  "use strict";

  const {def} = require('../../src/sesshim.js');
  const {visit} = require('../../src/interp-utils.js');

  function interpJSON(ast) {
    return new InterpJSONVisitor().i(ast);
  }

  class InterpJSONVisitor {
    constructor() {}
    i(ast) { return visit(ast, this); }
    data(_, value) { return value; }
    array(_, args) { return args.map(arg => this.i(arg)); }
    record(_, props) {
      const result = {};
      props.forEach(prop => visit(prop, {
        // An arrow function to capture lexical this
        prop: (_, key,val) => { result[this.i(key)] = this.i(val); }
      }));
      return result;
    }
  }

  return def({InterpJSONVisitor, interpJSON});
}());
