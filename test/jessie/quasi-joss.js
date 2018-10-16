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
const {binary} = require('../../interp-utils.js');
const {FAIL} = require('../../src/scanner.js');

const {jessie} = require('./quasi-jessie.js');

module.exports = (function() {
  "use strict";

  const joss = bnf.extends(jessie)`
    # Override rather than inherit start production.
    # The start production includes scripts, modules, and function
    # bodies. Does it therefore include Node modules? I think so.
    # Distinctions between these three would be post-parsing.
    # TODO: module syntax
    start ::= body EOF                                     ${(b,_) => (..._) => ['script',b]};


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
    # "super" in a manner conformant to the EcmaScript grammar.
    # Introduce leftExpr. Revise updateExpr to use leftExpr rather
    # than going directly to callExpr.
    # TODO Can we leverage our PEG grammar formalism to express the
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
    / callExpr NO_NEWLINE ("++" / "--")                    ${(e,_,op) => [`post${op}`,e]}
    / ("++" / "--") unaryExpr                              ${(op,e) => [`pre${op}`,e]};


    preOp ::=
      super.preOp
    / "delete"
    / "await";

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

    # TODO Override lValue to include all the possible interpretations
    # of leftExpr. Even once leftExpr exists, it would be better to
    # enumerate these lValue interpretations directly rather than use
    # the cover-grammar approach of the spec. Since we're using a PEG,
    # we should not need a cover grammar.


    # A.3 Statements

    statement ::=
      super.statement
    / "var" binding ** "," ";"                             ${(op,decls,_) => ['var',decls]}
    /                                                      ${_ => ['empty']}
    / "with" "(" expr ")" arm                              ${(_,_2,s,_3,b) => ['with',s,b]};

    # TODO provide all other variations of "for"
    breakableStatement ::=
      super.breakableStatement
    / "do" arm "while" "(" expr ")"                        ${(_,b,_2,_3,c,_4) => ['doWhile',b,c]};

    # override
    arm ::= statement;

    declaration ::=
      super.declaration
    / generatorDecl
    / asyncFuncDecl
    / asyncGeneratorDecl
    / classDecl;

    elementParam ::=
      super.elementParam
    / ellision;

    # override
    clause ::= caseLabel body                              ${(cs1,b) => ['clause',[cs1],[...b]]};


    # A.4 Functions and Classes

    asyncArrowFunc ::= "async" arrowFunc                   ${(_,a) => ['async',...a]};

    methodDef ::=
      super.methodDef
    / generatorMethod
    / asyncMethod
    / asyncGeneratorMethod;


    generatorMethod ::=
      "*" method                                           ${(_,m) => ['generator',...m]};

    generatorDecl ::=
      "function" "*" defVar "(" param ** "," ")" block     ${(_,n,_2,p,_3,b) => ['generator','functionDecl',n,p,b]};

    generatorExpr ::=
      "function" "*" defVar? "(" param ** "," ")" block    ${(_,n,_2,p,_3,b) => ['generator','functionExpr',n,p,b]};

    yieldExpr ::=
      "yield" NO_NEWLINE "*" assignExpr                    ${(_,_2,rep,e) => ['yieldAll',e]}
    / "yield" NO_NEWLINE assignExpr                        ${(_,_2,rep,e) => ['yield',e]}
    / "yield";                                             ${_ => ['yield']};


    asyncMethod ::=
      "async" method                                       ${(_,m) => ['async',...m]};

    asyncFuncDecl ::=
      "async" functionDecl                                 ${(_,f) => ['async',...f]};

    asyncFuncExpr ::=
      "async" functionExpr                                 ${(_,f) => ['async',...f]};


    asyncGeneratorMethod ::=
      "async" "*" method                                   ${(_,m) => ['asyncGenerator',...m]};

    asyncGeneratorDecl ::=
      "async" generatorDecl                                ${(_,['generator',...f]) => ['asyncGenerator',...f]};

    asyncGeneratorExpr ::=
      "async" generatorExpr                                ${(_,['generator',...f]) => ['asyncGenerator',...f]};

    # TODO classes


    # A.5 Scripts and Modules
      
    # TODO modules and full import export

  `;

  return def({joss});
}());
