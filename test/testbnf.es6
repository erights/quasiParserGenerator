// Options: --free-variable-checker --require --validate
/*global module require*/

module.exports = (function(){
  "use strict";

  const {def} = require('../src/sesshim.es6');
  const {Packratter} = require('../src/scanner.es6');
  const {bnf, metaCompile, doBnf} = require('../src/bootbnf.es6');
  const {scannerless} = require('../src/scannerless.es6');

  function doArith(bnfParam) {
    return bnfParam`
      start ::= expr EOF  ${(v,_) => v};
      expr ::=
        term "+" expr     ${(a,_,b) => (...subs) => a(...subs) + b(...subs)}
      / term;
      term ::=
        NUMBER            ${n => (..._) => JSON.parse(n)}
      / HOLE              ${h => (...subs) => subs[h]}
      / "(" expr ")"      ${(_,v,_2) => v};
     `;
  }

  const arith = doArith(bnf);

  function testArith(arith) {
    if (arith`1 + (-2 + ${3*11} + ${55-11}) + 4` !== 80) {
      throw Error('arith template handler did not work');
    }
  };

  testArith(arith);


  //---------------

  const arithRules = [
   ['def','start',['act',['expr','EOF'],0]],
   ['def','expr',['or',['act',['term','"+"','expr'],1],
                  'term']],
   ['def','term',['or',['act',['NUMBER'],2],
                  ['act',['HOLE'],3],
                  ['act',['"("','expr','")"'],4]]]];


  const arithActions = doArith((_, ...actions) => actions);



  const arith0 = metaCompile(arithRules)(...arithActions);

  testArith(arith0);

  testArith(doArith(doBnf(bnf)));


  //---------------

  const QuasiJSON = bnf`
    start ::= value EOF    ${(v,_) => v};
    value ::=
      prim                 ${p => (..._) => JSON.parse(p)}
    / array
    / record                # json.org calls this "object"
    / HOLE                 ${h => (...subs) => subs[h]};
    prim ::= STRING / NUMBER / "true" / "false" / "null";

    array ::= "[" value ** "," "]"
                           ${(_,vs,_2) => (...subs) => vs.map(v => v(...subs))};
    record ::= "{" (key ":" value) ** "," "}"
                           ${(_,pairs,_2) => (...subs) => {
                               const result = {};
                               for (let [k,_,v] of pairs) {
                                 result[k(...subs)] = v(...subs);
                               }
                               return result;
                           }};
    key ::=
      STRING               ${p => (..._) => JSON.parse(p)}
    / HOLE                 ${h => (...subs) => subs[h]};
  `;


  const piece = QuasiJSON`{${"foo"}: [${33}, 44]}`;

  console.log(piece);


  const JSONPlus = bnf.extends(QuasiJSON)`
    start ::= super.start;
    key ::=
      super.key
    / IDENT                ${id => (..._) => id};
  `;

  // Packratter._debug = true;

  const thing = JSONPlus`{"bar": ${piece}, baz: [55]}`;

  // Packratter._debug = false;

  console.log(thing);


  const scannerish = bnf.extends(scannerless)`
    start ::= token* EOF     ${toks => (..._) => toks};
    token ::= "he" / "++" / NUMBER / CHAR / HOLE;
  `;

  const tks = scannerish`33he llo${3}w ++ orld`;

  console.log(tks);


  //---------------

  const scannerlessArith = doArith(bnf.extends(scannerless));

  testArith(scannerlessArith);


  //---------------

  return def({});
}());
