// Options: --free-variable-checker --require --validate
/*global module require*/

// Chainmail is a holistic specification language for reasoning about
// risk and trust in an open world.
// See https://www.doc.ic.ac.uk/~scd/Holistic_Specs.WG2.3.pdf
// especially numbered slides 38(112) and 59(171).

// The Chainmail defined here is for use with Jessie and SES programs,
// and so builds on Jax, the subset of JavaScript for pure expressions.

const {def} = require('../../src/sesshim.js');
const {bnf} = require('../../src/bootbnf.js');
const {binary} = require('../../src/quasi-utils.js');
const {FAIL} = require('../../src/scanner.js');

const {jax} = require('./quasi-jax.js');

module.exports = (function() {
  "use strict";

  const chainmail = bnf.extends(jax)`
    # Override rather than inherit jax's start production.
    start ::= body EOF                                     ${(b,_) => (..._) => b};

    typeDecl ::=
      ":" type                                             ${(_,type) => ['type',type]}
    / "obeys" specName                                     ${(_,specName) => ['obeys',specName]}
    / "in" space                                           ${(_,space) => ['in',space]};

    type ::= useVar;
    specName ::= useVar;
    space ::= useVar;

    param ::= defVar typeDecl?                             ${(id,optType) => ['param',id,optType]};

    memberPostOp ::=
      super.memberPostOp
    / "::" useVar                                          ${(_,id) => ['getField',id]};

    field ::= "field" defVar typeDecl? ";"                 ${(_,id,optType,_2) => ['field',id,optType]};

    primAssertion ::=
      quantOp "(" param ** "," ")" assertion               ${(op,_,ps,_2,asrt) => [op,ps,asrt]}
    / preAssertionOp primAssertion                         ${(op,p) => [op,p]}
    / "(" assertion ")"                                    ${(_,p,_2) => p}
    / block
    / eagerExpr "calls" eagerExpr                          ${(caller,_,call) => ['calls',caller,call]}
    / eagerExpr;

    block ::= "{" statement* "}"                           ${(_,stats,_2) => ['block',stats]};
    statement ::= assertion ";"                            ${(a,_) => a};

    preAssertionOp ::=
      "not"
    / "was" / "previous" / "next" / "will"
    / "changes";

    quantOp ::= "forall" / "exists";

    # TODO Did "obeys" disappear?
    # TODO What does Sophia's "Calls" mean?
    assertion ::=
      primAssertion (assertionOp primAssertion)?           ${binary};

    assertionOp ::= 
      "and" / "or" 
    / "implies" / "if" / "iff"
    / "only" "if"                                          ${(_,_2) => 'implies'}
    / "canAccess" / "in" / "isa"
    / "@"                                                  ${_ => 'at'};

    policy ::= "policy" defVar assertion                   ${(_,id,asrt) => ['policy',id,asrt]};

    entry ::=
      "call" "(" param ** "," ")" typeDecl? ";"            ${(_,_2,ps,_3,optType) => ['func',ps,optType]}
    / "construct" "(" param ** "," ")" typeDecl? ";"       ${(_,_2,ps,_3,optType) => ['class',ps,optType]}
    / "method" propName "(" param ** "," ")" typeDecl? ";" ${(_,id,_2,ps,_3,optType) => ['method',id,ps,optType]}
    / "property" propName typeDecl? ";"                    ${(_,id,optType,_2) => ['property',id,optType]};

    spec ::=
      "spec" defVar "{" field* entry* policy* "}"          ${(_,id,_2,fs,ents,pols,_3) => ['spec',id,fs,ents,pols]};

    body ::= spec*;
  `;

  return def({chainmail});
}());
