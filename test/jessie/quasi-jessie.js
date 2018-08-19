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

  const jessie = bnf.extends(jax)`

    # Override rather than inherit jax's start production.
    # The start production includes scripts, modules, and function
    # bodies. Does it therefore include Node modules? I think so.
    # Distinctions between these three would be post-parsing.
    # TODO: module syntax
    start ::= body EOF                                     ${(b,_) => (..._) => ['script',b]};


    # A.1 Lexical Grammar

    # For proposed eventual send expressions
    LATER ::= NO_NEWLINE "!";


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

    pattern ::=
      dataLiteral                                          ${n => ['matchData',JSON.parse(n)]}
    / "[" param ** "," "]"                                 ${(_,ps,_2) => ['matchArray',ps]}
    / "{" propParam ** "," "}"                             ${(_,ps,_2) => ['matchObj',ps]}
    / defVar
    / HOLE                                                 ${h => ['patternHole',h]};

    param ::=
      "..." pattern                                        ${(_,p) => ['rest',p]}
    / defVar "=" assignExpr                                ${(v,_,e) => ['optional',v,e]}
    / pattern;

    propParam ::=
      "..." pattern                                        ${(_,p) => ['restObj',p]}
    / propName ":" pattern                                 ${(k,_,p) => ['matchProp',k,p]}
    / IDENT "=" assignExpr                                       ${(id,_,e) => ['optionalProp',id,id,e]}
    / IDENT                                                ${id => ['matchProp',id,id]};

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

    assignOp ::= 
      "*=" / "/=" / "%=" / "+=" / "-="
    / "<<=" / ">>=" / ">>>="
    / "&=" / "^=" / "|="
    / "**=";

    # to be overridden or extended
    # lValue is only useVar or elementExpr in Jessie.
    # Include only elementExpr from fieldExpr to avoid mutating
    # non-number-named properties.
    # Syntactically disallow ("delete" IDENT).
    # No pseudo-pattern lValues.
    # TODO: re-allow assignment to statically named fields,
    # since it is useful during initialization and prevented
    # thereafter by mandatory tamper-proofing.
    lValue ::= elementExpr / useVar;

    elementExpr ::=
      primaryExpr "[" indexExpr "]"                        ${(pe,_,e,_2) => ['index',pe,e]}
    / primaryExpr LATER "[" indexExpr "]"                  ${(pe,_,_2,e,_3) => ['indexLater',pe,e]};

    fieldExpr ::=
      primaryExpr "." IDENT_NAME                           ${(pe,_,id) => ['get',pe,id]}
    / primaryExpr LATER IDENT_NAME                         ${(pe,_,id) => ['getLater',pe,id]}
    / elementExpr;

    # The assignExpr form must come after the block form, to make proper use
    # of PEG prioritized choice.
    arrowFunc ::=
      arrowParams NO_NEWLINE "=>" block                    ${(ps,_,_2,b) => ['arrow',ps,b]}
    / arrowParams NO_NEWLINE "=>" assignExpr               ${(ps,_,_2,e) => ['lambda',ps,e]};
    arrowParams ::=
      IDENT                                                ${id => [['def',id]]}
    / "(" param ** "," ")"                                 ${(_,ps,_2) => ps};


    # A.3 Statements

    # No "var", empty statement, "with", "do/while", or "for/in". None
    # of the insane variations of "for". Only blocks are accepted for
    # flow-of-control statements.
    # The expr production must go last, so PEG's prioritized choice will
    # interpret {} as a block rather than an expression.
    statement ::=
      block
    / "if" "(" expr ")" block "else" block                 ${(_,_2,c,_3,t,_4,e) => ['if',c,t,e]}
    / "if" "(" expr ")" block                              ${(_,_2,c,_3,t) => ['if',c,t]}
    / "for" "(" declaration expr? ";" expr? ")" block      ${(_,_2,d,c,_3,i,_4,b) => ['for',d,c,i,b]}
    / "for" "(" declOp binding "of" expr ")" block         ${(_,_2,d,_3,e,_4,b) => ['forOf',d,e,b]}
    / "while" "(" expr ")" block                           ${(_,_2,c,_3,b) => ['while',c,b]}
    / "switch" "(" expr ")" "{" branch* "}"                ${(_,_2,e,_3,_4,bs,_5) => ['switch',e,bs]}
    / IDENT ":" statement                                  ${(label,_,stat) => ['label',label,stat]}
    / "try" block catcher finalizer                        ${(_,b,c,f) => ['try',b,c,f]}
    / "try" block finalizer                                ${(_,b,f) => ['try',b,f]}
    / "try" block catcher                                  ${(_,b,c) => ['try',b,c]}
    / terminator
    / "debugger" ";"                                       ${(_,_2) => ['debugger']}
    / expr ";"                                             ${(e,_) => e};

    # Each case branch must end in a terminating statement.
    terminator ::=
      "return" NO_NEWLINE expr ";"                         ${(_,_2,e,_3) => ['return',e]}
    / "return" ";"                                         ${(_,_2) => ['return']}
    / "break" NO_NEWLINE IDENT ";"                         ${(_,_2,label,_3) => ['break',label]}
    / "break" ";"                                          ${(_,_2) => ['break']}
    / "continue" NO_NEWLINE IDENT ";"                      ${(_,_2,label,_3) => ['continue',label]}
    / "continue" ";"                                       ${(_,_2) => ['continue']}
    / "throw" expr ";"                                     ${(_,e,_2) => ['throw',e]};

    # No "class" declaration.
    # No generator, async, or async iterator function.
    declaration ::=
      declOp binding ** "," ";"                            ${(op,decls,_) => [op,decls]}
    / functionDecl;

    declOp ::= "const" / "let";
    # Initializer is mandatory
    binding ::= pattern "=" assignExpr                           ${(p,_,e) => ['bind',p,e]};

    catcher ::= "catch" "(" pattern ")" block              ${(_,_2,p,_3,b) => ['catch',p,b]};
    finalizer ::= "finally" block                          ${(_,b) => ['finally',b]};

    branch ::= caseLabel+ "{" body terminator "}"          ${(cs,_,b,t,_2) => ['branch',cs,[...b,t]]};
    caseLabel ::=
      "case" expr ":"                                      ${(_,e) => ['case',e]}
    / "default" ":"                                        ${(_,_2) => ['default']};

    block ::= "{" body "}"                                 ${(_,b,_2) => ['block',b]};
    body ::= (statement / declaration)*;


    functionExpr ::=
      "function" defVar? "(" param ** "," ")" block        ${(_,n,_2,p,_3,b) => ['functionExpr',n,p,b]};
    functionDecl ::=
      "function" defVar "(" param ** "," ")" block         ${(_,n,_2,p,_3,b) => ['functionDecl',n,p,b]};
    methodDef ::=
      propName "(" param ** "," ")" block                  ${(n,_,p,_2,b) => ['methodDef',n,p,b]}
    / identGet propName "(" ")" block                      ${(_,n,_2,_3,b) => ['getter',n,[],b]}
    / identSet propName "(" param ")" block                ${(_,n,_2,p,_3,b) => ['setter',n,[p],b]};

  `;

  return def({jessie});
}());
