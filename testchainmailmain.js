// Options: --free-variable-checker --require --validate
/*global module require*/

module.exports = (function(){
  "use strict";

  const {def} = require('./src/sesshim.js');
  const {chainmail} = require('./test/chainmail/chainmail.js');

  console.log('----------');
  let ast = chainmail`

specification ValidPurse {
  field balance :Nat;

  method deposit(amount :Nat, src) {
    success implies {
      // trust
      pre src obeys ValidPurse;
      CanTrade(this, src);
      0 <= amount;
      amount <= pre src.balance;
      this.balance === (pre this.balance + amount);
      src.balance === (pre src.balance - amount);

      // risk
      forall p {
        ((pre p obeys ValidPurse) and
         ((p !== this) and (p !== src))) implies
        p.balance === pre p.balance;
      }
      forall o :Object, p obeys Purse {
        (o mayAccess p) implies pre (o mayAccess p)
      }
    }
    failure implies {
      // trust
      not {
        pre src obeys ValidPurse;
        pre CanTrade(this,src);
        0 <= amount;
        amount <= pre src.balance;
      }

      // risk
      forall p {
        (pre p obeys ValidPurse) implies
         (p.balance ==== pre p.balance);

      }
    }
  }
}

`;
  console.log(JSON.stringify(ast));

  return def({});
}());
