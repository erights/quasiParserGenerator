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
  

  // ////////////////  Subsetting EcmaScript 2017  /////////////


  // One language is a *syntactic subset* of another if every program
  // accepted by the smaller language's grammar is also accepted by
  // the larger language's grammar with the same meaning.

  // One language is a *semantic subset* of another if non-erroneous
  // execution of code in the smaller language would operate the same
  // way in the larger language.

  // One language is *absorbed* by another if code in the smaller
  // language can be run as code in the larger language without
  // modification. A smaller language which is not absorbed may often be
  // *transpiled* into the larger language by source-to-source
  // transformation.

  // JSON < TinySES < ObSES < SES < ES2017-strict < ES2017

  // Each step needs to be explained. Proceeding from right to left.

  // EcmaScript code may be in either strict code or sloppy code, so
  // the strict sublanguage is a syntactic, semantic, absorbed subset of
  // full EcmaScript by definition. (In addition, the strict
  // sublanguage started by approximating a syntactic and semantic
  // subset of the sloppy language, excluding "with" and throwing
  // errors where the sloppy language would instead silently act
  // insane. However, there are enough other differences between
  // strict and sloppy that the subset story should generally
  // be avoided.)

  // SES is a semantic, absorbed subset of ES2017-strict. SES accepts
  // the full ES2017-strict grammar and can run on ES2017-strict
  // without translation. SES freezes the primordials, so
  // mutations that would succeed in ES2017-strict instead throw in
  // SES. SES restricts the global scope, so attempts to dereference a
  // variable named, for example, "document" that might succeed in
  // ES2017-strict would instead fail, either statically or
  // dynamically, in SES. (Even though the failure may be static, we
  // do not consider this syntactic subsetting because it is based on
  // scoping rather than grammar.)

  // SES is the largest subset of ES2017-strict which is still an ocap
  // language. Its purpose is to run as many conventional EcmaScript
  // programs as possible while staying within ocap rules.

  // ObSES is a syntactic, absorbed subset of SES. ObSES approximates
  // the smallest useful subset of SES that is still pleasant to
  // program in using the objects-as-closures pattern. ObSES omits
  // "this" and classes. ObSES is not intended to run legacy code or
  // code that uses inheritance. ObSES includes only the "better
  // parts" of EcmaScript
  // (http://www.infoq.com/presentations/efficient-programming-language-es6).
  // The ObSES grammar can be parsed by convential means and is simple
  // enough to be compiled or interpreted easily. ObSES is not
  // expected to be user-facing, but rather a stepping stone towards
  // the definition of TinySES.

  // TinySES is a semantic, transpiled subset of ObSES. TinySES uses
  // the ObSES grammar, but transpiles it to restrict to eliminate
  // hazards for writing defensively consistent code and
  // non-exploitable security patterns. For example, a TinySES object
  // literal transpiles to an ObSES frozen object literal.

  // JSON is a syntactic absorbed subset of all the languages
  // above. As a subset of TinySES, JSON expresses frozen objects. As
  // a subset of the others, JSON expresses extensible objects with
  // configurable properties. Both interpretations are consistent with
  // the JSON language, but only the latter is equivalent to
  // "JSON.parse".


  // /////////////   TinySES as syntactic subset of SES  ///////////


  // The following ObSES and TinySES grammar is based on
  // (http://www.ecma-international.org/ecma-262/8.0/#sec-grammar-summary).
  // Unlike that page, lexical productions are named in all upper
  // case. Since both ObSES and TinySES have the same grammar but
  // TinySES is user-facing, we usually refer to this as the TinySES
  // grammar.

  // Unlike ES2017 and SES, TinySES has no semicolon insertion, and so
  // does not need a parser able to handle that. However, TinySES must
  // impose the NO_NEWLINE constraints from ES2017, so that every
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
  // contrast, in ES2017 and SES, "yield", "await", "implements", etc are
  // conditionally reserved. Thus we avoid the need for parameterized
  // lexical-level productions.

  // TinySES omits both the "in" expression and the for/in loop,
  // and thus avoid the need for parameterized parser-level
  // productions.

  // QUASI_* are lexical-level placeholders. QUASI_ALL should match a
  // self-contained template literal string that has no holes
  // " `...`". QUASI_HEAD should match the initial literal part of a
  // template literal with holes " `...${ ". QUASI_MID should match
  // the middle " }...${ ", and QUASI_TAIL the end " }...` ". The
  // reason these are difficult is that a "}" during a hole only
  // terminates the hole if it is balanced.  TODO: All these
  // placeholders currently fail.

  // Ouside the lexical grammar, other differences from
  // http://www.ecma-international.org/ecma-262/8.0/#sec-grammar-summary
  // are noted as comments within the grammar below.  That page uses a
  // cover grammar to avoid unbounded lookahead. Because the grammar
  // here is defined using a PEG (parsing expression grammar) which
  // supports unbounded lookahead, we avoid the need for a cover
  // grammar.

  // TinySES array literals omit elision (i.e., nothing between
  // commas).

  // TinySES treats "arguments" and "eval" as reserved keywords.
  // Strict mode already limits "arguments" and "eval" to the point
  // that they are effectively keywords in strict code.  TinySES does
  // include "..." both as rest and spread which provides the useful
  // functionality of "arguments" with less confusion.  The
  // EcmaScript/strict "eval" can be used for both direct and indirect
  // eval. TinySES has no direct eval and can use other evaluator APIs
  // to partially make up the difference.

  // TinySES omits computed property names. TinySES has syntax for
  // mutating only number-named properties, which include floating
  // point, NaN, Infinity, and -Infinity. TinySES omits syntactic
  // support for mutating other property names. TinySES has syntax for
  // computed lookup and mutation of number-named properties, but not
  // other property names.

  // TinySES includes arrow functions, "function" functions, concise
  // method syntax, and accessor (getter / setter) syntax.
  // TinySES may eventually grow to accept generators, async
  // functions, async iterator functions, all in their "function", arrow,
  // and method form. TinySES does not support symbols or general
  // computed property access, but may grow to as well, once we
  // understand its impact on static analyzability. However,
  // TinySES will continue to omit "this" as the central defining
  // difference between SES and TinySES. TinySES will therefore continue
  // to omit "class" as well.

  // Beyond subsetting ES2017, this grammar also includes the infix "!"
  // (eventually) operator from Dr.SES. We hope infix "!" eventually
  // becomes part of the standard EcmaScript grammar. But even if not,
  // infix "!" trivially transpiles into calls to the Dr.SES extended
  // promise API. See (http://research.google.com/pubs/pub40673.html).


  // /////// TinySES as a semantic, transpiled subset of SES ////////

  // TinySES freezes object literals and function literals by
  // default. Aside from Proxies, only frozen objects can have a
  // defensive API surface, since any client with direct access
  // may freeze them, disrupting assumptions. Freezing makes the API
  // tamper proof. But objects and functions can still easily express
  // mutable abstractions by capturing mutable lexical variables.

  // Should TinySES include assignment to fieldExpr as well as the
  // syntax for accessor properties? Assuming defensive objects are
  // frozen anyway, this introduces no hazards while allowing more
  // conventional-looking APIs.

  // A TinySES "function" function is not intended to be used as a
  // constructor. To prevent a client from causing confusion by
  // calling it as a constructor, TinySES "function" functions are
  // transpiled to hoisted "const" declarations initialized to arrow
  // functions, which works since TinySES omits "this" and
  // "arguments".
  // Note that a client with access to ObSES "function" function f
  // cannot actually do any more mischief than they could have done
  // for themselves anyway, so perhaps this transformation isn't
  // really needed anyway?
  // TODO: Besides "this" and "arguments", how else might an arrow
  // function differ from a "function" function?

  // It is unclear how TinySES should treat array literals. Unlike
  // objects, arrays cannot hide their mutable state behind an API that
  // is still pleasant. The square bracket index syntax is too
  // compelling. However, a non-frozen array is not defensive since
  // any client can freeze it. Ideomatic use of arrays makes pervasive
  // use of their ability to grow, so we cannot even protect them by
  // "seal" or "preventExtensions".

  // Currently, TinySES does not automatically freeze arrays, leaving
  // it to the programmer to do so before exposing them to
  // clients. Perhaps we can use static analysis to alert the
  // programmer where they may have failed to do so?

  // Open type questions: Assuming we somehow restrict arrays to
  // array-like usage, can TinySES be soundly statically typed with a
  // structural type system? What about trademarks/nominal-types and
  // auditors? How would this map to the wasm type system which does tag
  // checking but no deep parameterized type checking?  If static
  // checking makes sense, should we add some of TypeScript's or Flow's
  // syntax for optional type declarations?  Given function types
  // (parameter and return value), can the rest generally be inferred?
  // How would these types play with the Cap'n Proto types? What about
  // subtyping? What about contravariance?

  // TODO: Alternate approach: rather than freeze automatically, have
  // static analysis catch cases where non-frozen values may leak to
  // clients or code outside the current module. We might still freeze
  // functions and seal non-array objects anyway, for
  // defense-in-depth. But this would allow us to make use of mutable
  // arrays for internal calculations as well as frozen arrays for
  // communication. If we do this, we should allow assignment to field
  // expressions both for sealed mutable unreleased objects as well as
  // for accessor properties.

  const tinyses = bnf`

    # The start production includes scripts, modules, and function
    # bodies. Does it therefore include Node modules? I think so.
    # Distinctions between these three would be post-parsing.
    # TODO: module syntax
    start ::= body EOF                                     ${(b,_) => (..._) => ['script', b]};

    # TODO: Error if whitespace includes newline
    NO_NEWLINE ::= ;

    # TODO: quasiliterals aka template literals
    QUASI_ALL ::= ${() => FAIL};
    QUASI_HEAD ::= ${() => FAIL};
    QUASI_MID ::= ${() => FAIL};
    QUASI_TAIL ::= ${() => FAIL};

    # Omit "async", "arguments", and "eval" from IDENT in TinySES even
    # though ES2017 considers them in IDENT.
    RESERVED_WORD ::=
      KEYWORD / RESERVED_KEYWORD / FUTURE_RESERVED_WORD
    / "null" / "false" / "true"
    / "async" / "arguments" / "eval";

    KEYWORD ::=
      "break"
    / "case" / "catch" / "const" / "continue"
    / "debugger" / "default"
    / "else" / "export"
    / "finally" / "for" / "function"
    / "if" / "import"
    / "return"
    / "switch"
    / "throw" / "try" / "typeof"
    / "void"
    / "while";

    # Unused by TinySES but enumerated here, in order to omit them
    # from the IDENT token.
    RESERVED_KEYWORD ::=
      "class"
    / "delete" / "do"
    / "extends"
    / "in" / "instanceof"
    / "new"
    / "super"
    / "this"
    / "var"
    / "with"
    / "yield";

    FUTURE_RESERVED_WORD ::=
      "await" / "enum"
    / "implements" / "package" / "protected"
    / "interface" / "private" / "public";

    dataLiteral ::=  "null" / "false" / "true" / NUMBER / STRING;

    identName ::= IDENT / RESERVED_WORD;
    useVar ::= IDENT                                       ${id => ['use',id]};
    defVar ::= IDENT                                       ${id => ['def',id]}

    # For most identifiers that ES2017 treats as IDENT but recognized
    # as pseudo-keywords in a context manner, TinySES simply makes
    # keywords. However, this would be too painful for "get" and
    # "set", so instead we use our support syntactic predicates.
    identGet ::= IDENT                                     ${id => (id === "get" ? id : FAIL)};
    identSet ::= IDENT                                     ${id => (id === "set" ? id : FAIL)};

    # TinySES primaryExpr does not include "this", ClassExpression,
    # GeneratorExpression, or RegularExpressionLiteral.
    primaryExpr ::=
      dataLiteral                                          ${n => ['data',JSON.parse(n)]}
    / "[" arg ** "," "]"                                   ${(_,es,_2) => ['array',es]}
    / "{" prop ** "," "}"                                  ${(_,ps,_2) => ['object',ps]}
    / functionExpr
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
    / methodDef
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
    # Recognize b!foo(x) as distinct from calling b!foo post-parse
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
    # No "delete". No bitwise "~".
    preOp ::= "void" / "typeof" / "+" / "-" / "!";

    # Restrict index access to number-names, including
    # floating point, NaN, Infinity, and -Infinity.
    indexExpr ::= "+" preExpr                              ${(op,e) => [op,e]};

    # No bitwise operators, "instanceof", "in", "==", or "!=".  Unlike
    # ES8, none of the relational operators (including equality)
    # associate. To help readers, mixing relational operators always
    # requires explicit parens.
    # TODO: exponentiation "**" operator.
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
    # Include only elementExpr from fieldExpr to avoid mutating
    # non-number-named properties.
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

    # The expr form must come after the block for, to make proper use
    # of PEG prioritized choice.
    arrow ::=
      params NO_NEWLINE "=>" block                         ${(ps,_,_2,b) => ['arrow',ps,b]}
    / params NO_NEWLINE "=>" expr                          ${(ps,_,_2,e) => ['lambda',ps,e]};
    params ::=
      IDENT                                                ${id => [['def',id]]}
    / "(" param ** "," ")"                                 ${(_,ps,_2) => ps};

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

    # No generator or "class" declaration.
    # No async function yet, but might get added.
    declaration ::=
      declOp binding ** "," ";"                            ${(op,decls,_) => [op, decls]}
    / functionDecl;

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


    functionExpr ::=
      "function" defVar? "(" params ")" block          ${(_,n,_2,p,_3,b) => ['functionExpr',n,p,b]};
    functionDecl ::=
      "function" defVar "(" params ")" block           ${(_,n,_2,p,_3,b) => ['functionDecl',n,p,b]};
    methodDef
      propName "(" params ")" block                    ${(n,_,p,_2,b) => ['methodDef',n,p,b]}
    \ identGet propName "(" ")" block                  ${(_,n,_2,_3,b) => ['getter',n,[],b]}
    \ identSet propName "(" param ")" block            ${(_,n,_2,p,_3,b) => ['setter',n,[p],b]};

  `;

  return def({tinyses});
}());
