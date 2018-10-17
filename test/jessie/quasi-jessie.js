// Options: --free-variable-checker --require --validate
/*global module require*/

// Subsets of JavaScript, starting from the grammar as defined at
// http://www.ecma-international.org/ecma-262/9.0/#sec-grammar-summary

// See https://github.com/Agoric/Jessie/blob/master/README.md
// for documentation of the Jessie grammar defined here.

const {def} = require('../../src/sesshim.js');
const {bnf} = require('../../src/bootbnf.js');
const {FAIL} = require('../../src/scanner.js');

const {justin} = require('./quasi-justin.js');

module.exports = (function() {
  "use strict";

  const jessie = bnf.extends(justin)`

    # Override rather than inherit start production.
    # The start production includes scripts, modules, and function
    # bodies. Does it therefore include Node modules? I think so.
    # Distinctions between these three would be post-parsing.
    # TODO: module syntax, module syntax only
    start ::= body EOF                                     ${(b,_) => (..._) => ['script',b]};


    # A.1 Lexical Grammar

    # For proposed eventual send expressions
    LATER ::= NO_NEWLINE "!";

    # For most identifiers that ES2017 treats as IDENT but recognizes
    # as pseudo-keywords in a context dependent manner, Jessie simply
    # makes keywords. However, this would be too painful for "get" and
    # "set", so instead we use our parser-generator's support
    # syntactic predicates. TODO: Is it really too painful? Try it.
    GET ::= IDENT                                          ${id => (id === "get" ? id : FAIL)};
    SET ::= IDENT                                          ${id => (id === "set" ? id : FAIL)};


    # A.2 Expressions

    # Jessie primaryExpr does not include "this", ClassExpression,
    # GeneratorExpression, AsyncFunctionExpression, 
    # AsyncGenerarorExpression, or RegularExpressionLiteral.
    primaryExpr ::=
      super.primaryExpr
    / functionExpr;

    propDef ::=
      super.propDef
    / methodDef;

    # Extend to recognize proposed eventual get syntax.
    memberPostOp ::=
      super.memberPostOp
    / LATER "[" indexExpr "]"                              ${(_,_2,e,_3) => ['indexLater',e]}
    / LATER IDENT_NAME                                     ${(_,id) => ['getLater',id]};

    # Extend to recognize proposed eventual send syntax.
    # We distinguish b!foo(x) from calling b!foo by a post-parsing pass
    callPostOp ::=
      super.callPostOp
    / LATER args                                           ${(_,args) => ['callLater',args]};

    # to be extended
    assignExpr ::=
      super.assignExpr
    / arrowFunc
    / lValue ("=" / assignOp) assignExpr                   ${(lv,op,rv) => [op,lv,rv]};

    # In Jessie, an lValue is only a variable, a computed index-named
    # property (an array element), or a statically string-named
    # property.
    # We allow assignment to statically string-named fields, since it
    # is useful during initialization and prevented thereafter by
    # mandatory tamper-proofing.

    # to be overridden or extended
    lValue ::= 
      useVar
    / primaryExpr "[" indexExpr "]"                        ${(pe,_,e,_2) => ['index',pe,e]}
    / primaryExpr LATER "[" indexExpr "]"                  ${(pe,_,_2,e,_3) => ['indexLater',pe,e]}
    / primaryExpr "." IDENT_NAME                           ${(pe,_,id) => ['get',pe,id]}
    / primaryExpr LATER IDENT_NAME                         ${(pe,_,id) => ['getLater',pe,id]};

    assignOp ::= 
      "*=" / "/=" / "%=" / "+=" / "-="
    / "<<=" / ">>=" / ">>>="
    / "&=" / "^=" / "|="
    / "**=";


    # A.3 Statements

    # to be extended.
    # The exprStatement production must go last, so PEG's prioritized
    # choice will interpret {} as a block rather than an expression.
    statement ::=
      block
    / "if" "(" expr ")" arm "else" arm                     ${(_,_2,c,_3,t,_4,e) => ['if',c,t,e]}
    / "if" "(" expr ")" arm                                ${(_,_2,c,_3,t) => ['if',c,t]}
    / breakableStatement
    / terminator
    / IDENT ":" statement                                  ${(label,_,stat) => ['label',label,stat]}
    / IDENT ":" functionDecl                               ${(label,_,func) => ['label',label,func]}
    / "try" block catcher finalizer                        ${(_,b,c,f) => ['try',b,c,f]}
    / "try" block catcher                                  ${(_,b,c) => ['try',b,c]}
    / "try" block finalizer                                ${(_,b,f) => ['try',b,f]}
    / "debugger" ";"                                       ${(_,_2) => ['debugger']}
    / exprStatement;

    # to be overridden.  In Jessie, only blocks are accepted as arms
    # of flow-of-control statements.
    arm ::= block;

    breakableStatement ::=
      "for" "(" declaration expr? ";" expr? ")" arm        ${(_,_2,d,c,_3,i,_4,b) => ['for',d,c,i,b]}
    / "for" "(" declOp binding "of" expr ")" arm           ${(_,_2,d,_3,e,_4,b) => ['forOf',d,e,b]}
    / "while" "(" expr ")" arm                             ${(_,_2,c,_3,b) => ['while',c,b]}
    / "switch" "(" expr ")" "{" clause* "}"                ${(_,_2,e,_3,_4,bs,_5) => ['switch',e,bs]};

    # Each case clause must end in a terminating statement.
    terminator ::=
      "continue" NO_NEWLINE IDENT ";"                      ${(_,_2,label,_3) => ['continue',label]}
    / "continue" ";"                                       ${(_,_2) => ['continue']}
    / "break" NO_NEWLINE IDENT ";"                         ${(_,_2,label,_3) => ['break',label]}
    / "break" ";"                                          ${(_,_2) => ['break']}
    / "return" NO_NEWLINE expr ";"                         ${(_,_2,e,_3) => ['return',e]}
    / "return" ";"                                         ${(_,_2) => ['return']}
    / "throw" NO_NEWLINE expr ";"                          ${(_,e,_2) => ['throw',e]};

    block ::= "{" body "}"                                 ${(_,b,_2) => ['block',b]};
    body ::= statementItem*;

    # declaration must come first, so that PEG will prioritize
    # function declarations over exprStatement.
    statementItem ::=
      declaration
    / statement;

    # No "class" declaration.
    # No generator, async, or async iterator function.
    declaration ::=
      declOp binding ** "," ";"                            ${(op,decls,_) => [op,decls]}
    / functionDecl;

    declOp ::= "const" / "let";

    binding ::= 
      bindingPattern "=" assignExpr                        ${(p,_,e) => ['bind',p,e]}
    / defVar "=" assignExpr                                ${(p,_,e) => ['bind',p,e]}
    / defVar;

    bindingPattern ::=
      "[" elementParam ** "," "]"                          ${(_,ps,_2) => ['matchArray',ps]}
    / "{" propParam ** "," "}"                             ${(_,ps,_2) => ['matchRecord',ps]};

    pattern ::=
      bindingPattern
    / defVar
    / dataLiteral                                          ${n => ['matchData',JSON.parse(n)]}
    / HOLE                                                 ${h => ['patternHole',h]};

    # to be overridden
    elementParam ::= param;

    param ::=
      "..." pattern                                        ${(_,p) => ['rest',p]}
    / defVar "=" assignExpr                                ${(v,_,e) => ['optional',v,e]}
    / pattern;

    propParam ::=
      "..." pattern                                        ${(_,p) => ['restObj',p]}
    / propName ":" pattern                                 ${(k,_,p) => ['matchProp',k,p]}
    / defVar "=" assignExpr                                ${(id,_,e) => ['optionalProp',id,id,e]}
    / defVar                                               ${id => ['matchProp',id,id]};

    # Use PEG prioritized choice.
    # TODO emit diagnostic for failure cases.
    exprStatement ::=
      cantStartExprStatement                               ${FAIL}
    / expr ";"                                             ${(e,_) => e};

    cantStartExprStatement ::= 
      "{" / "function" / "async" NO_NEWLINE "function"
    / "class" / "let" "[";

    # to be overridden
    clause ::= caseLabel+ "{" body terminator "}"          ${(cs,_,b,t,_2) => ['clause',cs,[...b,t]]};
    caseLabel ::=
      "case" expr ":"                                      ${(_,e) => ['case',e]}
    / "default" ":"                                        ${(_,_2) => ['default']};

    catcher ::= "catch" "(" pattern ")" block              ${(_,_2,p,_3,b) => ['catch',p,b]};
    finalizer ::= "finally" block                          ${(_,b) => ['finally',b]};


    # A.4 Functions and Classes

    functionDecl ::=
      "function" defVar "(" param ** "," ")" block         ${(_,n,_2,p,_3,b) => ['functionDecl',n,p,b]};

    functionExpr ::=
      "function" defVar? "(" param ** "," ")" block        ${(_,n,_2,p,_3,b) => ['functionExpr',n,p,b]};

    # The assignExpr form must come after the block form, to make proper use
    # of PEG prioritized choice.
    arrowFunc ::=
      arrowParams NO_NEWLINE "=>" block                    ${(ps,_,_2,b) => ['arrow',ps,b]}
    / arrowParams NO_NEWLINE "=>" assignExpr               ${(ps,_,_2,e) => ['lambda',ps,e]};

    arrowParams ::=
      IDENT                                                ${id => [['def',id]]}
    / "(" param ** "," ")"                                 ${(_,ps,_2) => ps};

    # to be extended
    methodDef ::=
      method
    / GET propName "(" ")" block                           ${(_,n,_2,_3,b) => ['getter',n,[],b]}
    / SET propName "(" param ")" block                     ${(_,n,_2,p,_3,b) => ['setter',n,[p],b]};

    method ::=
      propName "(" param ** "," ")" block                  ${(n,_,p,_2,b) => ['method',n,p,b]};


    # A.5 Scripts and Modules

    # TODO modules and simple import export

  `;

  return def({jessie});
}());
