// Options: --free-variable-checker --require --validate
/*global module require*/

// Subsets of JavaScript, starting from the grammar as defined at
// http://www.ecma-international.org/ecma-262/9.0/#sec-grammar-summary

// Joss is approximately JavaScript-strict, but with the lexical
// limitations of Jessie.  Joss exists mainly to record what elements
// of JavaScript were omitted from Jessie, in case we want to move
// them back in. Because we're using a PEG (parsing expression
// grammar) we do not need a cover grammar.

// See https://github.com/Agoric/Jessie/blob/master/README.md
// for documentation of the Jessie grammar defined here.

const {def} = require('../../src/sesshim.js');
const {bnf} = require('../../src/bootbnf.js');
const {binary} = require('../../quasi-utils.js');
const {FAIL} = require('../../src/scanner.js');

const {jessie} = require('./quasi-jessie.js');

module.exports = (function() {
  "use strict";

  const joss = bnf.extends(jessie)`
    start ::= super.start;


    # A.1 Lexical Grammar

    REGEXP ::= FAIL;


    # A.2 Expressions

    primaryExpr ::=
      super.primaryExpr
    / classExpr
    / generatorExpr
    / asyncFuncExpr
    / asyncGeneratorExpr
    / REGEXP;

    element ::=
      super.element
    / ellision;

    # empty
    ellision ::=                                           ${_ => ['ellision']};

    # TODO record trailing comma

    propName ::=
      super.propName
    / "[" assignExpr "]"                                   ${(_,e,_2) => ['computed',e]};

    # override rather than extend
    indexExpr ::= expr;


    # TODO introduce memberExpr and newExpr, and override rather than
    # extend callExpr and updateExpr, in order to introduce "new" and
    # "super" in a manner conformant to the EcmaScript grammar.  TODO
    # Can we leverage our PEG grammar formalism to express the
    # standard grammar more simply?

    callExpr ::=
      super.callExpr
    / "new" "." "target"                                   ${_ => ['newTarget']}
    / "new" memberExpr args                                ${(_,e,args) => ['newCall',e,args]}
    / "super" "[" indexExpr "]"                            ${(_,_2,e,_3) => ['superIndex',e]}
    / "super" "." IDENT_NAME                               ${(_,_2,name) => ['superGet',e]}
    / "super" args                                         ${(_,args) => ['superCall',args]};

    updateExpr ::=
      super.updateExpr
    / leftExpr NO_NEWLINE ("++" / "--")                    ${(e,_,op) => [`post${op}`,e]}
    / ("++" / "--") unaryExpr                              ${(op,e) => [`pre${op}`,e]};

    preOp ::=
      super.preOp
    / "delete" unaryExpr                                   ${(_,e) => ['delete',e]};

    // override with standard
    relExpr ::= addExpr (relOp addExpr)*                   ${binary};
    eqExpr ::= relExpr (eqOp relExpr)*                     ${binary};
    bitAndExpr ::= eqExpr ("&" eqExpr)*                    ${binary};
    bitXorExpr ::= bitAndExpr ("^" bitAndExpr)*            ${binary};
    bitOrExpr ::= bitXorExpr ("|" bitXorExpr)*             ${binary};

    eagerExpr ::= bitOrExpr;

    relOp ::= super.relOp / "in" / "instanceof";
    eqOp ::= super.eqOp / "==" / "!==";

    assignExpr ::=
      super.assignExpr
    / yieldExpr
    / asyncArrowFunc;

    # TODO
    yieldExpr ::= FAIL;
    asyncArrowFunc ::= FAIL;

  `;

  return def({joss});
}());
