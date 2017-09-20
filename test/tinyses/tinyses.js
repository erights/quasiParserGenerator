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
  // 2015), tiny ses is a minimal "better parts"
  // (http://www.infoq.com/presentations/efficient-programming-language-es6)
  // subset of SES-strict. SES is a semantic, not a syntactic, subset
  // of ES6. Tiny Ses is mostly defined as a syntactic subset of
  // SES-strict. The following tiny ses grammar is based on
  // http://www.ecma-international.org/ecma-262/6.0/#sec-grammar-summary
  // Unlike that page, lexical productions are named in all upper
  // case. The intention is that tiny ses be a true subset of SES in
  // the sense that every valid tiny ses program is a valid SES
  // program of the same meaning.

  // Unlike ES6 and SES, tiny ses has no semicolon insertion, and so
  // does not need a parser able to handle that. However, tiny ses
  // must impose the NO_NEWLINE constraints from ES6, so that every
  // non-rejected tiny ses program is accepted as the same SES
  // program. NO_NEWLINE is a lexical-level placeholder that must
  // never consume anything. It should fail if the whitespace to skip
  // over contains a newline. TODO: Currently this placeholder always
  // succeeds.

  // Tiny Ses excludes the RegularExpressionLiteral, instead including
  // the RegExp.make https://github.com/mikesamuel/regexp-make-js
  // template string tag. By omitting this and automatic semicolon
  // insertion, our lexical grammar avoids the context dependence that
  // plague JavaScript lexers.

  // In tiny ses, all reserved words are unconditionally reserved. By
  // contrast, in ES6 and SES, "yield", "await", "implements", etc are
  // conditionally reserved. Thus we avoid the need for parameterized
  // lexical-level productions.

  // Tiny Ses excludes both the "in" expression and the for/in loop,
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
  // are noted as comments within the grammar below.
  // That page uses a cover grammar to avoid unbounded
  // lookahead. Because the grammar here is defined using a PEG
  // (parsing expression grammar) which supports unbounded lookahead,
  // we avoid the need for a cover grammar.

  // Tiny Ses array literals exclude elision (i.e., nothing between
  // commas).

  // Tiny Ses omits "arguments" and "eval".
  // EcmaScript/strict already limits "arguments" and "eval"
  // to the point that they are effectively keywords.
  // Tiny Ses does include "..." both as rest and spread
  // which provides the useful functionality of "arguments"
  // with less confusion.
  // The EcmaScript/strict "eval" can be used for both
  // direct and indirect eval. Tiny Ses has no direct eval
  // and can use other evaluator APIs to make up the difference.

  // Beyond subsetting ES6, this grammar also includes the infix "!"
  // (eventually) operator from
  // http://research.google.com/pubs/pub40673.html

  const tinyses = bnf`
    # TODO: module syntax
    start ::= body EOF                                     ${(b,_) => (..._) => ['script', b]};

    NO_NEWLINE ::= ;

    QUASI_ALL ::= ${() => FAIL};
    QUASI_HEAD ::= ${() => FAIL};
    QUASI_MID ::= ${() => FAIL};
    QUASI_TAIL ::= ${() => FAIL};

    # Exclude "arguments" and "eval" from IDENT in tiny ses.
    RESERVED_WORD ::=
      KEYWORD / ES6_ONLY_KEYWORD / FUTURE_RESERVED_WORD
    / "arguments" / "eval";

    KEYWORD ::=
      "null" / "false" / "true"
    / "break" / "case" / "catch" / "const"
    / "debugger" / "default" / "delete"
    / "else" / "export" / "finally"
    / "for" / "if" / "import"
    / "return" / "switch" / "throw" / "try"
    / "typeof" / "void" / "while";

    # Tiny Ses omits these ES6 keywords.
    # We enumerate these anyway, in order to exclude them from the
    # IDENT token.
    ES6_ONLY_KEYWORD ::=
      "class" / "continue" / "do" / "extends"
    / "function" / "in" / "instanceof" / "new" / "super"
    / "this" / "var" / "with" / "yield";

    FUTURE_RESERVED_WORD ::=
      "enum" / "await"
    / "implements" / "interface" / "package"
    / "private" / "protected" / "public";

    IDENT_NAME ::=
      IDENT / RESERVED_WORD;

    dataLiteral ::= NUMBER / STRING / "null" / "true" / "false";

    # Tiny Ses primaryExpr does not include "this", ClassExpression,
    # GeneratorExpression, or RegularExpressionLiteral.
    # No "function" functions.
    primaryExpr ::=
      IDENT                                                ${n => ['use',n]}
    / dataLiteral                                          ${n => ['data',JSON.parse(n)]}
    / "[" arg ** "," "]"                                   ${(_,es,_2) => ['array',es]}
    / "{" prop ** "," "}"                                  ${(_,ps,_2) => ['object',ps]}
    / quasiExpr
    / "(" expr ")"                                         ${(_,e,_2) => e}
    / HOLE                                                 ${h => ['exprHole',h]};

    arg ::=
      "..." expr                                           ${(_,e) => ['spread',e]}
    / expr;

    # No method definition.
    prop ::=
      key ":" expr                                         ${(k,_,e) => ['prop',k,e]}
    / IDENT                                                ${id => ['prop',id,['use',id]]};

    pattern ::=
      IDENT                                                ${n => ['def',n]}
    / "[" param ** "," "]"                                 ${(_,ps,_2) => ['matchArray',ps]}
    / "{" propParam ** "," "}"                             ${(_,ps,_2) => ['matchObj',ps]}
    / HOLE                                                 ${h => ['patternHole',h]};

    param ::=
      "..." pattern                                        ${(_,p) => ['rest',p]}
    / pattern "=" expr                                     ${(p,_,e) => ['optional',p,e]}
    / pattern;

    propParam ::=
      key ":" pattern "=" expr                             ${(k,_,p,_2,e) => ['optionalProp',k,p,e]}
    / key ":" pattern                                      ${(k,_,p) => ['matchProp',k,p]}
    / IDENT "=" expr                                       ${(id,_,e) => ['optionalProp',id,['def',id],e]}
    / IDENT                                                ${id => ['matchProp',id,['def',id]]};

    key ::=
      IDENT_NAME / STRING / NUMBER
    / "[" expr "]"                                         ${(_,k) => ['computed', k]};

    quasiExpr ::=
      QUASI_ALL                                            ${q => ['quasi',[q]]}
    / QUASI_HEAD (expr (QUASI_MID expr)*)? QUASI_TAIL      ${(h,ms,t) => ['quasi',qunpack(h,ms,t)]};

    later ::= NO_NEWLINE "!";

    # No "new", "super", or MetaProperty. Without "new" we don't need
    # separate MemberExpr and CallExpr productions.
    postExpr ::= primaryExpr postOp*                       ${binary};
    fieldOp ::=
      "." IDENT_NAME                                       ${(_,id) => ['get',id]}
    / "[" expr "]"                                         ${(_,e,_2) => ['index',e]}
    / later IDENT_NAME                                     ${(_,id) => ['getLater',id]}
    / later "[" expr "]"                                   ${(_,_2,e,_3) => ['indexLater',e]};

    postOp ::=
      fieldOp
    / "(" arg ** "," ")"                                   ${(_,args,_2) => ['call',args]}
    / quasiExpr                                            ${q => ['tag',q]}
    / later "(" arg ** "," ")"                             ${(_,_2,args,_3) => ['callLater',args]}
    / later quasiExpr                                      ${(_,q) => ['tagLater',q]};

    preExpr ::=
      "delete" fieldExpr                                   ${(_,fe) => ['delete', fe]}
    / preOp preExpr                                        ${(op,e) => [op,e]}
    / postExpr;

    # No prefix or postfix "++" or "--".
    preOp ::= "void" / "typeof" / "+" / "-" / "!";

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

    # lValue is divided into IDENT and fieldExpr because tiny ses
    # syntactically disallows "delete" IDENT.
    # No pseudo-pattern lValues.
    lValue ::=
      IDENT                                                ${n => ['use',n]}
    / fieldExpr;

    fieldExpr ::= postExpr fieldOp                         ${(left,[op,right]) => [op,left,right]};

    # No bitwise operators
    assignOp ::= "=" / "*=" / "/=" / "%=" / "+=" / "-=";

    arrow ::=
      params NO_NEWLINE "=>" block                         ${(ps,_,_2,b) => ['arrow',ps,b]}
    / params NO_NEWLINE "=>" expr                          ${(ps,_,_2,e) => ['lambda',ps,e]};
    params ::=
      IDENT                                                ${id => [['def',id]]}
    / "(" param ** "," ")"                                 ${(_,ps,_2) => ps};

    # No "var", empty statement, "continue", "with",
    # "for/in", or labelled statement.
    # None of the insane variations of "for".
    # Only blocks are accepted for flow-of-control statements.
    statement ::=
      block
    / "if" "(" expr ")" block "else" block                 ${(_,_2,c,_3,t,_4,e) => ['if',c,t,e]}
    / "if" "(" expr ")" block                              ${(_,_2,c,_3,t) => ['if',c,t]}
    / "do" block "while" "(" expr ")" ";"                  ${(_,b,_2,_3,c,_4,_5) => ['doWhile',b,c]}
    / "while" "(" expr ")" block                           ${(_,_2,c,_3,b) => ['while',c,b]}
    / "for" "(" declaration expr? ";" expr? ")" block      ${(_,_2,d,c,_3,i,_4,b) => ['for',d,c,i,b]}
    / "for" "(" declOp binding "of" expr ")" block         ${(_,_2,d,_3,e,_4,b) => ['forOf',d,e,b]}
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
