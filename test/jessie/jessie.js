// Options: --free-variable-checker --require --validate
/*global module require*/

// Subsets of JavaScript, starting from the grammar as defined at
// http://www.ecma-international.org/ecma-262/9.0/#sec-grammar-summary

// See https://github.com/Agoric/Jessie/blob/master/README.md
// for documentation of the Jessie grammar defined here.

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


  const json = bnf`
    # to be overridden or inherited
    start ::= assignExpr EOF                               ${(v,_) => (..._) => v};

    # to be extended
    primaryExpr ::=
      dataLiteral                                          ${n => ['data',JSON.parse(n)]}
    / array
    / record
    / HOLE                                                 ${h => ['exprHole',h]};

    dataLiteral ::=  "null" / "false" / "true" / NUMBER / STRING;

    array ::= "[" element ** "," "]"                       ${(_,es,_2) => ['array',es]};

    # to be extended
    element ::= assignExpr;

    # The JavaScript and JSON grammars calls records "objects"
    record ::= "{" propDef ** "," "}"                         ${(_,ps,_2) => ['record',ps]};

    # to be extended
    propDef ::= propName ":" assignExpr                       ${(k,_,e) => ['prop',k,e]};

    # to be extended
    propName ::= STRING;

    # to be overridden or extended
    assignExpr ::= primExpr;
  `;


  const jax = bnf.extends(json)`
    start ::= super.start;

    # A.1 Lexical Grammar

    # TODO: Error if whitespace includes newline
    NO_NEWLINE ::= ;

    IDENT_NAME ::= IDENT / RESERVED_WORD;

    # Omit "async", "arguments", and "eval" from IDENT in Jax even
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

    # Unused by Jax but enumerated here, in order to omit them
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

    # TODO: quasiliterals aka template literals
    QUASI_ALL ::= ${() => FAIL};
    QUASI_HEAD ::= ${() => FAIL};
    QUASI_MID ::= ${() => FAIL};
    QUASI_TAIL ::= ${() => FAIL};


    # A.2 Expressions

    useVar ::= IDENT                                       ${id => ['use',id]};
    defVar ::= IDENT                                       ${id => ['def',id]};

    # For most identifiers that ES2017 treats as IDENT but recognizes
    # as pseudo-keywords in a context dependent manner, Jax simply makes
    # keywords. However, this would be too painful for "get" and
    # "set", so instead we use our parser-generator's support syntactic
    # predicates. TODO: Is it really too painful? Try it.
    identGet ::= IDENT                                     ${id => (id === "get" ? id : FAIL)};
    identSet ::= IDENT                                     ${id => (id === "set" ? id : FAIL)};

    primaryExpr ::=
      super.primaryExpr
    / quasiExpr
    / "(" expr ")"                                         ${(_,e,_2) => e}
    / useVar;

    element ::=
      super.element
    / "..." assignExpr                                     ${(_,e) => ['spread',e]};

    propDef ::=
      super.propDef
    / IDENT                                                ${id => ['prop',id,id]}
    / "..." assignExpr                                     ${(_,e) => ['spreadObj',e]};

    # No computed property name
    propName ::=
      super.propName
    / IDENT_NAME
    / NUMBER;
    
    quasiExpr ::=
      QUASI_ALL                                            ${q => ['quasi',[q]]}
    / QUASI_HEAD (expr (QUASI_MID expr)*)? QUASI_TAIL      ${(h,ms,t) => ['quasi',qunpack(h,ms,t)]};

    # to be extended We only distinguish memberExpr from callExpr to
    # accommodate sub-grammars that add "new". Without "new" these
    # could be collapsed together.
    memberExpr ::= primaryExpr memberPostOp*               ${binary};

    # to be extended
    memberPostOp ::=
      "[" indexExpr "]"                                    ${(_,e,_2) => ['index',e]}
    / "." IDENT_NAME                                       ${(_,id) => ['get',id]}
    / quasiExpr                                            ${q => ['tag',q]};

    # To be overridden rather than inherited.
    # Introduced to impose a non-JS restriction
    # Restrict index access to number-names, including
    # floating point, NaN, Infinity, and -Infinity.
    indexExpr ::= 
      NUMBER                                               ${n => ['data',n]}
    / "+" unaryExpr                                        ${(op,e) => [op,e]};

    # to be extended
    newExpr ::= memberExpr;

    # to be extended
    callExpr ::= memberExpr callPostOp+                    ${binary};

    callPostOp ::=
      memberPostOp
    / args                                                 ${args => ['call',args]};

    args ::= "(" arg ** "," ")"                            ${(_,args,_2) => args};

    arg ::=
      assignExpr
    / "..." assignExpr                                     ${(_,e) => ['spread',e]};

    # split from lvalue, which Jessie can restrict assignment.
    # leftExpr remains purely to express predecence.
    leftExpr ::=
      newExpr
    / callExpr;

    # to be extended
    updateExpr ::= leftExpr;

    unaryExpr ::=
      preOp unaryExpr                                      ${(op,e) => [op,e]}
    / updateExpr;

    # to be extended
    # No prefix or postfix "++" or "--".
    # No "delete". No bitwise "~".
    preOp ::= "void" / "typeof" / "+" / "-" / "~" / "!";

    # Different communities will think -x**y parses in different ways,
    # so the EcmaScript grammar forces parens to disambiguate.
    powExpr ::=
      unaryExpr
    / updateExpr "**" powExpr                              ${(x,op,y) => [op,x,y]};

    multExpr ::= powExpr (multOp powExpr)*                 ${binary};
    addExpr ::= multExpr (addOp multExpr)*                 ${binary};
    shiftExpr ::= addExpr (shiftOp addExpr)*               ${binary};

    # Non-standard, to be overridden
    # In C-like languages, the precedence and associativity of the
    # relational, equality, and bitwise operators is surprising, and
    # therefore hazardous. Here, none of these associate with the
    # others, forcing parens to disambiguate.
    eagerExpr ::= addExpr (eagerOp addExpr)?               ${binary};

    andThenExpr ::= eagerExpr ("&&" eagerExpr)*            ${binary};
    orElseExpr ::= andThenExpr ("||" andThenExpr)*         ${binary};

    multOp ::= "*" / "/" / "%";
    addOp ::= "+" / "-";    
    shiftOp ::= "<<" / ">>" / ">>>";
    relOp ::= "<" / ">" / "<=" / ">=";
    eqOp ::= "===" / "!==";
    bitOp ::= "&" / "^" / "|";

    eagerOp ::= relOp / eqOp / bitOp;

    condExpr ::=
      orElseExpr
    / orElseExpr "?" assignExpr ":" assignExpr             ${(c,_,t,_2,e) => ['cond',c,t,e]};

    # to be extended
    assignExpr ::=
      condExpr;

    expr ::= assignExpr ("," assignExpr)*                  ${binary};
  `;


  const chainmail = bnf.extends(jax)`
    # Override rather than inherit jax's start production.
    start ::= body EOF                                     ${(b,_) => (..._) => ['script',b]};

    # TODO
    body ::=;
  `;


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

    # No "new", "super", or MetaProperty.
    # Extend to recognize proposed eventual send syntax.
    # After parsing distinguish b!foo(x) as distinct from calling b!foo.
    memberPostOp ::=
      super.memberPostOp
    / LATER IDENT_NAME                                     ${(_,id) => ['getLater',id]}
    / LATER "[" indexExpr "]"                              ${(_,_2,e,_3) => ['indexLater',e]}
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
    arrow ::=
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

  // Joss is approximately JavaScript-strict, but with the lexical
  // limitations of Jessie.  Joss exists mainly to record what
  // elements of JavaScript were omitted from Jessie, in case we want
  // to move them back in. Because we're using a PEG (parsing
  // expression grammar) we do not need a cover grammar.
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

    memberExpr ::=
      super.member
    / superProp
    / metaProp
    / "new" memberExpr args                                ${(_,e,args) => ['newCall',e,args]};

    # override rather than extend
    indexExpr ::= expr;

    superProp ::=
      "super" "[" indexExpr "]"                            ${(_,_2,e,_3) => ['super',e]}
    / "super" "." IDENT_NAME;

    metaProp ::= "new" "." "target"                        ${_ => ['newTarget']};

    # override rather than extend
    indexExpr ::= expr;

    newExpr ::=
      super.newExpr
    / "new" newExpr                                        ${(_,e) => ['newCall',e,[]]};

    callExpr ::=
      super.callExpr
    / "super" args                                         ${(_,args) => ['superCall',args]};

    updateExpr ::=
      super.updateExpr
    / leftExpr NO_NEWLINE ("++" / "--")                    ${(e,_,op) => [`post${op}`,e]}
    / ("++" / "--") unaryExpr                              ${(op,e) => [`pre${op}`,e]}

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


  `;

  return def({json, jax, chainmail, jessie, joss});
}());
