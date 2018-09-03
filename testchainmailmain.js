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

  policy Pol_1 forall (a1:Purse, a2:Purse, b1:Nat, b2:Nat, amt:Nat) {
    a1 !== a2;
    a1::mint === a2::mint;
    a1::balance === b1 and b1 > amt;
    a2::balance === b2;
    _ calls a2.deposit(amt, a1);
  } implies will {
    a1::balance === b1 - amt;
    a2::balance === b2 + amt;
  }

  policy Pol_2 forall (b:Mint) {
    will ((changes b::currency) @ S);
  } implies exists (o in S) {
    o in S;
    o canAccess b;
    not (o in internal b);
  }

  policy Pol_2_equiv forall (b:Mint) {
    forall (o in S) {
      (not (o canAccess b) or (o in internal b)) implies
        not (will (changes b::currency)) @ S;
    }
  }
}

`;
  console.log(JSON.stringify(ast, undefined, ' '));

  return def({});
}());
