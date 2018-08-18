// Options: --free-variable-checker --require --validate
/*global module require*/

// Subsets of JavaScript, starting from the grammar as defined at
// http://www.ecma-international.org/ecma-262/9.0/#sec-grammar-summary

// See https://github.com/Agoric/Jessie/blob/master/README.md
// for documentation of the Jessie grammar defined here.

const {def} = require('../../src/sesshim.js');
const {bnf} = require('../../src/bootbnf.js');

const {jax} = require('./quasi-jax.js');

module.exports = (function() {
  "use strict";

  const chainmail = bnf.extends(jax)`
    # Override rather than inherit jax's start production.
    start ::= body EOF                                     ${(b,_) => (..._) => ['script',b]};

    # TODO
    body ::= FAIL;
  `;

  return def({chainmail});
}());
