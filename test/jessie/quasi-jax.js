// Options: --free-variable-checker --require --validate
/*global module require*/

// Subsets of JavaScript, starting from the grammar as defined at
// http://www.ecma-international.org/ecma-262/9.0/#sec-grammar-summary

// Jax is the safe JAvaScript eXpression grammar, a potentially pure
// decidable superset of JSON and subset of Jessie, that relieves many
// of the pain points of using JSON as a data format:
//   * unquoted indentifier property names.
//   * comments.
//   * multi-line strings (via template literals).
//   * undefined.
//   * includes all floating point values: NaN, Infinity, -Infinity
//   * will include BigInt once available.

// Jax also includes most pure JavaScript expressions. Jax does not
// include function expressions or variable or function
// definitions. However, it does include free variable uses and
// function calls; so the purity and decidability of Jax depends on
// the endowments provided for these free variable bindings.

// Defined to be extended into the Jessie grammar.
// See https://github.com/Agoric/Jessie/blob/master/README.md
// for documentation of the Jessie grammar.

// Defined to be extended into the Chainmail grammar, to provide its
// expression language in a JS-like style. Chainmail expressions
// need to be pure and should be decidable.

const {def} = require('../../src/sesshim.js');
const {bnf} = require('../../src/bootbnf.js');
const {FAIL} = require('../../src/scanner.js');

const {json} = require('./quasi-json.js');


module.exports = (function() {
  "use strict";

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
    / "[" indexExpr "]"                                    ${(_,e,_2) => ['index',e]}
      "." IDENT_NAME                                       ${(_,id) => ['get',id]}
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
    assignExpr ::= condExpr;

    expr ::= assignExpr ("," assignExpr)*                  ${binary};
  `;

  return def({jax});
}());
