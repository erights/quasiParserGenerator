// Options: --free-variable-checker --require --validate
/*global module require*/

module.exports = (function() {
  "use strict";

  const {def} = require('../../src/sesshim.js');
  const {bnf} = require('../../src/bootbnf.js');

  const binary = (left,rights) => rights.reduce((prev,[op,right]) => [op,prev,right], left);

  const qunpack = (h,ms,t) => {
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
  };

  const {FAIL, Packratter} = require('../../src/scanner.js');
  // Packratter._debug = true;

  // Whereas SES is a maximal ocap-secure subset of ES6 (EcmaScript
  // 2015), TinySES is a minimal "better parts"
  // (http://www.infoq.com/presentations/efficient-programming-language-es6)
  // subset of SES. SES is a semantic, not a syntactic, subset of
  // ES6. TinySES is mostly defined as a syntactic subset of SES. The
  // following TinySES grammar is based on
  // http://www.ecma-international.org/ecma-262/6.0/#sec-grammar-summary
  // Unlike that page, lexical productions are named in all upper
  // case. The intention is that TinySES be a true subset of SES in
  // the sense that every valid TinySES program is a valid SES program
  // of the same meaning. TinySES is a superset of JSON.
  // JSON < TinySES < SES < ES6

  // Unlike ES6 and SES, TinySES has no semicolon insertion, and so
  // does not need a parser able to handle that. However, TinySES must
  // impose the NO_NEWLINE constraints from ES6, so that every
  // non-rejected TinySES program is accepted as the same SES
  // program. NO_NEWLINE is a lexical-level placeholder that must
  // never consume anything. It should fail if the whitespace to skip
  // over contains a newline. TODO: Currently this placeholder always
  // succeeds.

  // TinySES omits the RegularExpressionLiteral, instead including
  // the RegExp.make https://github.com/mikesamuel/regexp-make-js
  // template string tag. By omitting this and automatic semicolon
  // insertion, our lexical grammar avoids the context dependence that
  // plague JavaScript lexers.

  // In TinySES, all reserved words are unconditionally reserved. By
  // contrast, in ES6 and SES, "yield", "await", "implements", etc are
  // conditionally reserved. Thus we avoid the need for parameterized
  // lexical-level productions.

  // TinySES omits both the "in" expression and the for/in loop,
  // and thus avoid the need for parameterized parser-level
  // productions.

  // QUASI_* are lexical-level placeholders. QUASI_ALL should match a
  // self-contained template literal string that has no holes " `...`
  // ". QUASI_HEAD should match the initial literal part of a template
  // literal with holes " `...${ ". QUASI_MID should match the middle
  // " }...${ ", and QUASI_TAIL the end " }...` ". The reason these
  // are difficult is that a "}" during a hole only terminates the
  // hole if it is balanced.  TODO: All these placeholders currently
  // fail.

  // Ouside the lexical grammar, other differences from
  // http://www.ecma-international.org/ecma-262/6.0/#sec-grammar-summary
  // are noted as comments within the grammar below.  That page uses a
  // cover grammar to avoid unbounded lookahead. Because the grammar
  // here is defined using a PEG (parsing expression grammar) which
  // supports unbounded lookahead, we avoid the need for a cover
  // grammar.

  // TinySES array literals omit elision (i.e., nothing between
  // commas).

  // TinySES omits "arguments" and "eval".  EcmaScript/strict already
  // limits "arguments" and "eval" to the point that they are
  // effectively keywords.  TinySES does include "..." both as rest
  // and spread which provides the useful functionality of "arguments"
  // with less confusion.  The EcmaScript/strict "eval" can be used
  // for both direct and indirect eval. TinySES has no direct eval and
  // can use other evaluator APIs to make up the difference.

  // TinySES omits computed property names. TinySES has syntax for
  // mutating only number-named properties, which include floating
  // point, NaN, Infinity, and -Infinity. TinySES omits syntactic
  // support for mutating other property names. TinySES has syntax for
  // computed lookup and mutation of number-named properties, but not
  // other property names.

  // TinySES may eventually be extended with the following elements of
  // SES: "function" function declarations and expressions, generators
  // and async functions, arrow function and concise method forms of
  // these, continue, label and break and continue to label, and
  // symbols and general computed property access. However, TinySES
  // will continue to omit "this" as that is the central defining
  // difference between SES and TinySES.

  // Beyond subsetting ES6, this grammar also includes the infix "!"
  // (eventually) operator from
  // http://research.google.com/pubs/pub40673.html

  // Defensive TinySES arrays should be sealed or frozen, and all
  // other TinySES objects and functions should be frozen, in order to
  // present a tamper-proof API surface to potential SES
  // adversaries. Unfortunately, sealed arrays cannot grow, and
  // extensible arrays cannot reject the addition of non-number-named
  // properties. Doing this manually is accident prone, which can be
  // mitigated in the following ways:
  //    * Static analysis to diagnose where tamper proofing operations
  //      need to be added.
  //    * Source-to-source transformation of TinySES to TinySES where
  //      these tamper proofing operations are added
  //      automatically. The source language of this transformation
  //      looks like TinySES but has a different semantics, and so needs a
  //      different language name.
  //    * Placing TinySES objects on a membrane, such that the
  //      membrane freezes all wet objects on their first encounter
  //      with the membrane.
  //    * Placing TinySES objects on a membrane, such that the
  //      membrane only relays non-tampering operations through the
  //      membrane from dry to wet.

  // Stanalone TinySES would be a TinySES used alone, without SES and
  // without those standard library elements irrelevant or dangerous
  // to standalone use of TinySES. Standalone TinySES library would
  // omit those builtin functions that would modify non-number-named
  // properties. Thus, automatic tamper proofing, such as by
  // source-to-source transformation would make little semantic
  // difference to Standalone TinySES programs.

  const tinyses = bnf`
    # TODO: module syntax
    start ::= body EOF                                     ${(b,_) => (..._) => ['script', b]};

    # TODO: Error if whitespace includes newline
    NO_NEWLINE ::= ;

    # TODO: quasiliterals aka template literals
    QUASI_ALL ::= ${() => FAIL};
    QUASI_HEAD ::= ${() => FAIL};
    QUASI_MID ::= ${() => FAIL};
    QUASI_TAIL ::= ${() => FAIL};

    # Omit "arguments" and "eval" from IDENT in TinySES.
    RESERVED_WORD ::=
      KEYWORD / ES6_ONLY_KEYWORD / FUTURE_RESERVED_WORD
    / "arguments" / "eval";

    KEYWORD ::=
      "null" / "false" / "true"
    / "break" / "case" / "catch" / "const"
    / "debugger" / "default"
    / "else" / "export" / "finally"
    / "for" / "if" / "import"
    / "return" / "switch" / "throw" / "try"
    / "typeof" / "void" / "while";

    # Unused by TinySES but enumerated these anyway, in order to
    # omit them from the IDENT token.
    ES6_ONLY_KEYWORD ::=
      "class" / "continue" / "delete" / "do" / "extends"
    / "function" / "in" / "instanceof" / "new" / "super"
    / "this" / "var" / "with" / "yield";

    FUTURE_RESERVED_WORD ::=
      "enum" / "await"
    / "implements" / "interface" / "package"
    / "private" / "protected" / "public";

    dataLiteral ::=  NUMBER / STRING / "null" / "false" / "true";

    identName ::= IDENT / RESERVED_WORD;
    useVar ::= IDENT                                       ${id => ['use',id]};
    defVar ::= IDENT                                       ${id => ['def',id]}

    # TinySES primaryExpr does not include "this", ClassExpression,
    # GeneratorExpression, or RegularExpressionLiteral.
    # No "function" functions.
    primaryExpr ::=
      dataLiteral                                          ${n => ['data',JSON.parse(n)]}
    / "[" arg ** "," "]"                                   ${(_,es,_2) => ['array',es]}
    / "{" prop ** "," "}"                                  ${(_,ps,_2) => ['object',ps]}
    / quasiExpr
    / "(" expr ")"                                         ${(_,e,_2) => e}
    / useVar
    / HOLE                                                 ${h => ['exprHole',h]};

    pattern ::=
      dataLiteral                                          ${n => ['matchData',JSON.parse(n)]}
    / "[" param ** "," "]"                                 ${(_,ps,_2) => ['matchArray',ps]}
    / "{" propParam ** "," "}"                             ${(_,ps,_2) => ['matchObj',ps]}
    / defVar
    / HOLE                                                 ${h => ['patternHole',h]};

    arg ::=
      "..." expr                                           ${(_,e) => ['spread',e]}
    / expr;

    param ::=
      "..." pattern                                        ${(_,p) => ['rest',p]}
    / defVar "=" expr                                      ${(v,_,e) => ['optional',v,e]}
    / pattern;

    # No method definition.
    prop ::=
      "..." expr                                           ${(_,e) => ['spreadObj',e]}
    / propName ":" expr                                    ${(k,_,e) => ['prop',k,e]}
    / IDENT                                                ${id => ['prop',id,id]};

    propParam ::=
      "..." pattern                                        ${(_,p) => ['restObj',p]}
    / propName ":" pattern                                 ${(k,_,p) => ['matchProp',k,p]}
    / IDENT "=" expr                                       ${(id,_,e) => ['optionalProp',id,id,e]}
    / IDENT                                                ${id => ['matchProp',id,id]};

    # No computed property name
    propName ::=  identName / STRING / NUMBER;

    quasiExpr ::=
      QUASI_ALL                                            ${q => ['quasi',[q]]}
    / QUASI_HEAD (expr (QUASI_MID expr)*)? QUASI_TAIL      ${(h,ms,t) => ['quasi',qunpack(h,ms,t)]};

    later ::= NO_NEWLINE "!";

    # No "new", "super", or MetaProperty. Without "new" we don't need
    # separate MemberExpr and CallExpr productions.
    postExpr ::= primaryExpr postOp*                       ${binary};
    postOp ::=
      "." identName                                        ${(_,id) => ['get',id]}
    / "[" indexExpr "]"                                    ${(_,e,_2) => ['index',e]}
    / "(" arg ** "," ")"                                   ${(_,args,_2) => ['call',args]}
    / quasiExpr                                            ${q => ['tag',q]}

    / later identName                                      ${(_,id) => ['getLater',id]}
    / later "[" indexExpr "]"                              ${(_,_2,e,_3) => ['indexLater',e]}
    / later "(" arg ** "," ")"                             ${(_,_2,args,_3) => ['callLater',args]};

    # Omit ("delete" fieldExpr) to avoid mutating properties
    preExpr ::=
      preOp preExpr                                        ${(op,e) => [op,e]}
    / postExpr;

    # No prefix or postfix "++" or "--".
    preOp ::= "void" / "typeof" / "+" / "-" / "!";

    # Restrict index access to number-names, including
    # floating point, NaN, Infinity, and -Infinity.
    indexExpr ::= "+" preExpr                              ${(op,e) => [op,e]};

    # No bitwise operators, "instanceof", or "in".  Unlike ES6, none
    # of the relational operators associate. To help readers, mixing
    # relational operators always requires explicit parens.
    multExpr ::= preExpr (("*" / "/" / "%") preExpr)*      ${binary};
    addExpr ::= multExpr (("+" / "-") multExpr)*           ${binary};
    relExpr ::= addExpr (relOp addExpr)?                   ${binary};
    relOp ::= "<" / ">" / "<=" / ">=" / "===" / "!==";
    andThenExpr ::= relExpr ("&&" relExpr)*                ${binary};
    orElseExpr ::= andThenExpr ("||" andThenExpr)*         ${binary};

    # No trinary ("?:") expression
    # No comma expression, so assignment expression is expr.
    expr ::=
      lValue assignOp expr                                 ${(lv,op,rv) => [op,lv,rv]}
    / arrow
    / orElseExpr;

    # lValue is only useVar or elementExpr in TinySES.
    # Include only elementExpr from fieldExpr to avoid mutating non-numeric properties.
    # Syntactically disallow ("delete" IDENT).
    # No pseudo-pattern lValues.
    lValue ::= elementExpr / useVar;

    elementExpr ::=
      primaryExpr "[" indexExpr "]"                        ${(pe,_,e,_2) => ['index',pe,e]}
    / primaryExpr later "[" indexExpr "]"                  ${(pe,_,_2,e,_3) => ['indexLater',pe,e]};

    fieldExpr ::=
      primaryExpr "." identName                            ${(pe,_,id) => ['get',pe,id]}
    / primaryExpr later "." identName                      ${(pe,_,_2,id) => ['getLater',pe,id]}
    / elementExpr;

    # No bitwise operators
    assignOp ::= "=" / "*=" / "/=" / "%=" / "+=" / "-=";

    arrow ::=
      params NO_NEWLINE "=>" block                         ${(ps,_,_2,b) => ['arrow',ps,b]}
    / params NO_NEWLINE "=>" expr                          ${(ps,_,_2,e) => ['lambda',ps,e]};
    params ::=
      IDENT                                                ${id => [['def',id]]}
    / "(" param ** "," ")"                                 ${(_,ps,_2) => ps};

    # No "var", empty statement, "continue", "with", "do/while",
    # "for/in", or labelled statement. None of the insane variations
    # of "for". Only blocks are accepted for flow-of-control
    # statements.
    # The expr production must go last, so PEG's prioritized choice will
    # interpret {} as a block rather than an expression.
    statement ::=
      block
    / "if" "(" expr ")" block "else" block                 ${(_,_2,c,_3,t,_4,e) => ['if',c,t,e]}
    / "if" "(" expr ")" block                              ${(_,_2,c,_3,t) => ['if',c,t]}
    / "for" "(" declaration expr? ";" expr? ")" block      ${(_,_2,d,c,_3,i,_4,b) => ['for',d,c,i,b]}
    / "for" "(" declOp binding "of" expr ")" block         ${(_,_2,d,_3,e,_4,b) => ['forOf',d,e,b]}
    / "while" "(" expr ")" block                           ${(_,_2,c,_3,b) => ['while',c,b]}
    / "try" block catcher finalizer                        ${(_,b,c,f) => ['try',b,c,f]}
    / "try" block finalizer                                ${(_,b,f) => ['try',b,f]}
    / "try" block catcher                                  ${(_,b,c) => ['try',b,c]}
    / "switch" "(" expr ")" "{" branch* "}"                ${(_,_2,e,_3,_4,bs,_5) => ['switch',e,bs]}
    / terminator
    / "debugger" ";"                                       ${(_,_2) => ['debugger']}
    / expr ";"                                             ${(e,_) => e};

    # Each case branch must end in a terminating statement. No
    # labelled break.
    terminator ::=
      "return" NO_NEWLINE expr ";"                         ${(_,_2,e,_3) => ['return',e]}
    / "return" ";"                                         ${(_,_2) => ['return']}
    / "break" ";"                                          ${(_,_2) => ['break']}
    / "throw" expr ";"                                     ${(_,e,_2) => ['throw',e]};

    # no "function", generator, or "class" declaration.
    declaration ::= declOp binding ** "," ";"              ${(op,decls,_) => [op, decls]};
    declOp ::= "const" / "let";
    # Initializer is mandatory
    binding ::= pattern "=" expr                           ${(p,_,e) => ['bind', p, e]};

    catcher ::= "catch" "(" pattern ")" block              ${(_,_2,p,_3,b) => ['catch',p,b]};
    finalizer ::= "finally" block                          ${(_,b) => ['finally',b]};

    branch ::= caseLabel+ "{" body terminator "}"          ${(cs,_,b,t,_2) => ['branch',cs,[...b,t]]};
    caseLabel ::=
      "case" expr ":"                                      ${(_,e) => ['case', e]}
    / "default" ":"                                        ${(_,_2) => ['default']};

    block ::= "{" body "}"                                 ${(_,b,_2) => ['block', b]};
    body ::= (statement / declaration)*;
  `;

  return def({tinyses});
}());
