// Options: --free-variable-checker --require --validate
/*global module require*/

module.exports = (function() {
  "use strict";

  const {def} = require('../../src/sesshim.es6');
  const {bnf} = require('../../src/bootbnf.es6');

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

  const {FAIL, Packratter} = require('../../src/scanner.es6');
  // Packratter._debug = true;

  // Whereas SES is a maximal ocap-secure subset of ES6 (EcmaScript
  // 2015), microses is a minimal "better parts"
  // (http://www.infoq.com/presentations/efficient-programming-language-es6)
  // subset of SES-strict. SES is a semantic, not a syntactic, subset
  // of ES6. Microses is mostly defined as a syntactic subset of
  // SES-strict. The following microses grammar is based on
  // http://www.ecma-international.org/ecma-262/6.0/#sec-grammar-summary
  // Unlike that page, lexical productions are named in all upper
  // case. The intention is that microses be a true subset of SES in
  // the sense that every valid microses program is a valid SES
  // program of the same meaning.

  // Unlike ES6 and SES, microses has no semicolon insertion, and so
  // does not need a parser able to handle that. However, microses
  // must impose the NO_NEWLINE constraints from ES6, so that every
  // non-rejected microses program is accepted as the same SES
  // program. NO_NEWLINE is a lexical-level placeholder that must
  // never consume anything. It should fail if the whitespace to skip
  // over contains a newline. TODO: Currently this placeholder always
  // succeeds.

  // Microses excludes the RegularExpressionLiteral, instead including
  // the RegExp.make https://github.com/mikesamuel/regexp-make-js
  // template string tag. By omitting this and automatic semicolon
  // insertion, our lexical grammar avoids the context dependence that
  // plague JavaScript lexers.

  // In microses, all reserved words are unconditionally reserved. By
  // contrast, in ES6 and SES, "yield", "await", "implements", etc are
  // conditionally reserved. Thus we avoid the need for parameterized
  // lexical-level productions.

  // Microses excludes both the "in" expression and the for/in loop,
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
  // That page uses a cover grammar do avoid unbounded
  // lookahead. Because the grammar here is defined using a PEG
  // (parsing expression grammar) which supports unbounded lookahead,
  // we avoid the need for a cover grammar.

  // Microses array literals exclude elision (i.e., nothing between
  // commas). 

  // Beyond subsetting ES6, this grammar also includes the infix "!"
  // (eventually) operator from
  // http://research.google.com/pubs/pub40673.html

  const microses = bnf`
    # TODO: module syntax
    start ::= body EOF                                     ${(b,_) => (..._) => ['script', b]};

    NO_NEWLINE ::= ;

    QUASI_ALL ::= ${() => FAIL};
    QUASI_HEAD ::= ${() => FAIL};
    QUASI_MID ::= ${() => FAIL};
    QUASI_TAIL ::= ${() => FAIL};

    # Exclude "arguments" and "eval" from IDENT in microses.
    RESERVED_WORD ::= 
      KEYWORD / ES6_ONLY_KEYWORD / FUTURE_RESERVED_WORD
    / "arguments" / "eval";

    KEYWORD ::=
      "false" / "true"
    / "break" / "case" / "catch" / "const"
    / "debugger" / "default" / "delete"
    / "else" / "export" / "finally"
    / "for" / "if" / "import"
    / "return" / "switch" / "throw" / "try"
    / "typeof" / "void" / "while";

    # We enumerate these anyway, in order to exclude them from the
    # IDENT token.
    ES6_ONLY_KEYWORD ::=
      "null" / "class" / "continue" / "do" / "extends"
    / "function" / "in" / "instanceof" / "new" / "super"
    / "this" / "var" / "with" / "yield";

    FUTURE_RESERVED_WORD ::=
      "enum" / "await"
    / "implements" / "interface" / "package"
    / "private" / "protected" / "public";

    # Microses primaryExpr does not include "this", ClassExpression, 
    # GeneratorExpression, or RegularExpressionLiteral.
    # No "null". No "function" functions.
    primaryExpr ::=
      (NUMBER / STRING / "true" / "false")                 ${n => ['data',JSON.parse(n)]}
    / "[" arg ** "," "]"                                   ${(_,es,_2) => ['array',es]}
    / "{" prop ** "," "}"                                  ${(_,ps,_2) => ['object',ps]}
    / quasiExpr
    / "(" expr ")"                                         ${(_,e,_2) => e}
    / IDENT
    / HOLE                                                 ${h => ['exprHole',h]};

    pattern ::=
      (NUMBER / STRING / "true" / "false")                 ${n => ['matchData',JSON.parse(n)]}
    / "[" param ** "," "]"                                 ${(_,ps,_2) => ['matchArray',ps]}
    / "{" propParam ** "," "}"                             ${(_,ps,_2) => ['matchObj',ps]}
    / IDENT
    / HOLE                                                 ${h => ['patternHole',h]};

    arg ::=
      "..." expr                                           ${(_,e) => ['spread',e]}
    / expr;

    param ::=
      "..." pattern                                        ${(_,p) => ['rest',p]}
    / IDENT "=" expr                                       ${(id,_,e) => ['optional',id,e]}
    / pattern;

    # No method definition.
    prop ::=
      "..." expr                                           ${(_,e) => ['spreadObj',e]}
    / key ":" expr                                         ${(k,_,e) => ['prop',k,e]}
    / IDENT                                                ${id => ['prop',id,id]};

    propParam ::=
      "..." pattern                                        ${(_,p) => ['restObj',p]}
    / key ":" pattern                                      ${(k,_,p) => ['matchProp',k,p]}
    / IDENT "=" expr                                       ${(id,_,e) => ['optionalProp',id,id,e]}
    / IDENT                                                ${id => ['matchProp',id,id]};

    key ::= 
      IDENT / RESERVED_WORD / STRING / NUMBER
    / "[" expr "]"                                         ${(_,k) => ['computed', k]};

    quasiExpr ::=
      QUASI_ALL                                            ${q => ['quasi',[q]]}
    / QUASI_HEAD (expr (QUASI_MID expr)*)? QUASI_TAIL      ${(h,ms,t) => ['quasi',qunpack(h,ms,t)]};

    later ::= NO_NEWLINE "!";

    # No "new", "super", or MetaProperty. Without "new" we don't need
    # separate MemberExpr and CallExpr productions.
    postExpr ::= primaryExpr postOp*                       ${binary};
    postOp ::=
      "." IDENT                                            ${(_,id) => ['get',id]}
    / "[" expr "]"                                         ${(_,e,_2) => ['index',e]}
    / "(" arg ** "," ")"                                   ${(_,args,_2) => ['call',args]}
    / quasiExpr                                            ${q => ['tag',q]}

    / later IDENT                                          ${(_,id) => ['getLater',id]}
    / later "[" expr "]"                                   ${(_,_2,e,_3) => ['indexLater',e]}
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

    # lValue is divided into IDENT and fieldExpr because microses
    # syntactically disallows "delete" IDENT.
    # No pseudo-pattern lValues.
    lValue ::= IDENT / fieldExpr;

    fieldExpr ::=
      primaryExpr "." IDENT                                ${(pe,_,id) => ['get',pe,id]}
    / primaryExpr "[" expr "]"                             ${(pe,_,e,_2) => ['index',pe,e]}
    / primaryExpr later IDENT                              ${(pe,_,id) => ['getLater',pe,id]}
    / primaryExpr later "[" expr "]"                       ${(pe,_,_2,e,_3) => ['indexLater',pe,e]};

    # No bitwise operators
    assignOp ::= "=" / "*=" / "/=" / "%=" / "+=" / "-=";

    arrow ::=
      params NO_NEWLINE "=>" block                         ${(ps,_,_2,b) => ['arrow',ps,b]}
    / params NO_NEWLINE "=>" expr                          ${(ps,_,_2,e) => ['lambda',ps,e]};
    params ::=
      IDENT                                                ${id => [id]}
    / "(" param ** "," ")"                                 ${(_,ps,_2) => ps};

    # No "var", empty statement, "continue", "with", "do/while",
    # "for/in", or labelled statement. None of the insane variations
    # of "for". Only blocks are accepted for flow-of-control
    # statements.
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

  return def({microses});
}());
