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
const {FAIL} = require('../../src/scanner.js');

const {jax} = require('./quasi-jax.js');

module.exports = (function() {
  "use strict";

  const chainmail = bnf.extends(jax)`
    # Override rather than inherit jax's start production.
    start ::= body EOF                                     ${(b,_) => (..._) => ['script',b]};

    typeDecl ::= ":" type                                  ${(_,type) => ['type',type]};
    type ::= useVar;

    param ::= defVar typeDecl?                             ${(id,optType) => ['param',id,optType]};

    memberPostOp ::=
      super.memberPostOp
    / "::" IDENT_NAME                                      ${(_,id) => ['getField',id]};

    field ::= "field" defVar typeDecl? ";"                 ${(_,id,optType,_2) => ['field',id,optType]};

    entry ::=
      "method" propName "(" param ** "," ")" typeDecl? ";" ${(_,id,_2,ps,_3,optType) => ['method',id,ps,optType]}
    / "property" propName typeDecl? ";"                    ${(_,id,optType,_2) => ['property',id,optType]};

    primAssertion ::=
      eagerExpr
    / primAssertionOp primAssertion                        ${(op,p) => [op,p]}
    / quantOp param ++ "," "." primAssertion               ${(op,ps,_,assrt) => [op,ps,assrt]}
    / "(" assertion ")"                                    ${(_,p,_2) => p};

    # I'm not sure what keyword is appropriate for Sophia's hollow and
    # solid circles. My current guess is "may" the a solid circle and
    # "was" is the hollow circle.  TODO find out.
    # TODO Is "changes" the old "mayEffect"? Why is it now unary?
    primAssertionOp ::=
      "may"
    / "was"
    / "changes";

    quantOp ::= "forall" / "exists";

    # TODO Did "obeys" disappear?
    assertion ::=
      primAssertion (assertionOp primAssertion)*           ${binary}
    / primAssertion "@" space                              ${(assrt,_,space) => ['at',assrt,space]};

    # TODO
    space ::= ${FAIL};

    # TODO is "access" the old "mayAccess"?
    assertionOp ::= 
      "and" / "or" / "implies"
    / "access";

    policy ::= "policy" defVar assertion ";"               ${(_,id,assrt) => ['policy',id,assrt]};

    spec ::=
      "specification defVar "{" field* entry* policy* "}"  ${(_,id,_2,fs,ents,pols,_3) => ['spec',id,fs,ents,pols]};

    body ::= spec*;
  `;

  return def({chainmail});
}());
