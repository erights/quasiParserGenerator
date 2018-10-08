// Options: --free-variable-checker --require --validate
/*global module require*/

module.exports = (function(){
  "use strict";

  const {def} = require('./src/sesshim.js');
  const {chainmail} = require('./test/jessie/quasi-chainmail.js');

  console.log('----------');

  
  // From https://www.doc.ic.ac.uk/~scd/Holistic_Specs.WG2.3.pdf
  
  const mintMakerSpec = chainmail`


# An Assay is pass-by-copy data that, interpreted in the context of a
# given Issuer, represents some set of erights as issued by that
# Issuer. This is referred to as an "amount", though it is not
# necessarily a number or quantity. Every Assay type must be able to
# represent the empty set of erights.
specification Issuer[Assay] {

  specification Mint {
    method getIssuer() :Issuer;


    # Where new units come from
    method mint(amount ?Assay) :Purse;

    field currency:Nat;
    field internal:Set;

    policy internal_mba_1
    forall (b:Mint, x) {
      (x in b::internal) iff {
        (x === b) or ((x isa Purse) and (x::mint === b));
      };
    }

  # I don't understand mba_2
  }

  specification Purse {
    method getIssuer() :Issuer;

    # The set of erights currently in the purse.
    method getBalance() :Assay;

    # Move 'amount' erights from 'src' into this purse.
    method deposit(amount ?Assay, src ?Purse);


    field mint obeys Mint;
    field balance:Nat;
  
    policy transfer_1 
    # With two purses of same mint one can transfer money between them.
    forall (a1:Purse, a2:Purse, b1:Nat, b2:Nat, amt:Nat) {
      a1 !== a2;
      a1::mint === a2::mint;
      a1::balance === b1 and b1 > amt;
      a2::balance === b2;
      calls a2.deposit(amt, a1);
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
      not (o in b::internal);
    }
  
    policy violate_conserve_2_equiv 
    forall (b:Mint) {
      forall (o in S) {
        (not (o canAccess b) or (o in b::internal)) implies
          not ((will (changes b::currency)) @ S);
      };
    }
  
    policy violate_conserve_2_reformulate
    # A set S whose elements have direct access to b only if they are
    # internal to b is insufficient to modify b.currency.
    forall (b:Mint) {
      forall (o in S) {
        ((o canAccess b) only if (o in b::internal)) implies
          not ((will (changes b::currency)) @ S);
      };
    }
  
    policy inflate_3
    # The bank can only inflate its own currency
    { # TODO
    }
  
    policy must_have_4
    # No one can affect the balance of a purse they do not have.
    forall (a:Purse) {
      will ((changes a::balance) @ S) only if exists (o in S) {
        o canAccess a;
        not (o in a::internal);
      };
    }
  
    policy non_neg_5
    # Balances are always non-negative.
    { # TODO
    }
  
    policy trust_6
    # A reported successful deposit can be trusted as much as one trusts
    # the purse one is depositing to.  
    { # TODO
    }
  }

  # Make a fresh purse initially holding no erights (the empty set of
  # erights), but able to hold the kinds of erights managed by this
  # issuer.
  method makeEmptyPurse() :Purse;

  # Convenience for making a fresh empty purse, transfering 'amount'
  # into it from this one, and returning it.
  method getExclusive(amount ?Assay, src ?Purse) :Purse;
  
  # 'includes' asks whether 'providedAmount' describes a set of erights
  # that includes all erights in the set described by 'neededAmount'.
  #
  # The parameter names suggest only one of two major use
  # cases. The other is 'includes(offeredAmount, takenAmount)'
  method includes(providedAmount ?Assay, neededAmount ?Assay);
}
`;
  console.log(JSON.stringify(mintMakerSpec, undefined, ' '));

  return def({mintMakerSpec});
}());
