// Options: --free-variable-checker --require --validate
/*global module require*/

module.exports = (function(){
  "use strict";

  const {def} = require('./src/sesshim.js');
  const {chainmail} = require('./test/jessie/quasi-chainmail.js');

  console.log('----------');
  let ast = chainmail`

spec Mint {
  field currency:Nat;

  method makePurse(amount:Nat) obeys Purse;
}

spec Purse {
  field mint obeys Mint;
  field balance:Nat;

  method deposit(amount:Nat, src);

  policy transfer_1 
  # With two purses of same mint one can transfer money between them.
  forall (a1:Purse, a2:Purse, b1:Nat, b2:Nat, amt:Nat) {
    a1 !== a2;
    a1::mint === a2::mint;
    a1::balance === b1 and b1 > amt;
    a2::balance === b2;
    _ calls a2.deposit(amt, a1);
  } implies will {
    a1::balance === b1 - amt;
    a2::balance === b2 + amt;
  }

  policy violate_conserve_2 
  # Only someone with the mint of a given currency can violate
  # conservation of that currency.

  # If some execution which starts now and which involves at most the
  # objects from S modifies b::currency at some future time, then at
  # least one of the objects in S can access b directly now, and this
  # object is not internal to b.
  forall (b:Mint) {
    will ((changes b::currency) @ S);
  } implies exists (o in S) {
    o in S;
    o canAccess b;
    not (o in internal b);
  }

  policy violate_conserve_2_equiv 
  forall (b:Mint) {
    forall (o in S) {
      (not (o canAccess b) or (o in internal b)) implies
        not ((will (changes b::currency)) @ S);
    };
  }

  policy violate_conserve_2_reformulate
  # A set S whose elements have direct access to b only if they are
  # internal to b is insufficient to modify b.currency.
  forall (b:Mint) {
    forall (o in S) {
      ((o canAccess b) implies (o in internal b)) implies
        not ((will (changes b::currency)) @ S);
    };
  }

  policy inflate_3
  # The bank can only inflate its own currency
  {}

  policy must_have_4
  # No one can affect the balance of a purse they do not have.
  {}

  policy non_neg_5
  # Balances are always non-negative.
  {}

  policy trust_6
  # A reported successful deposit can be trusted as much as one trusts
  # the purse one is depositing to.  
  {}
}

`;
  console.log(JSON.stringify(ast, undefined, ' '));

  return def({});
}());
