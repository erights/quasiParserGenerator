var bootbnf = require('../src/bootbnf.es6');

function doArith(bnf) {
  return bnf`
    start ::= expr EOF  ${(v,_) => v};
    expr ::= 
      term "+" expr     ${(a,_,b) => (...subs) => a(...subs) + b(...subs)}
    | term;
    term ::=
      NUMBER            ${n => (..._) => JSON.parse(n)}
    | HOLE              ${(h) => (...subs) => subs[h]}
    | "(" expr ")"      ${(_,v,_2) => v};
   `;
}

function testArith(arith, left, right, answer) {
  if (arith`1 + (2 + ${left} + ${right}) + 4` !== answer) {
    throw Error('arith template handler did not work');
  }
};

var arith = doArith(bootbnf);

testArith(arith, 33, 44, 84);


//---------------

var arithRules = [
 ['def','start',['act',['expr','EOF'],0]],
 ['def','expr',['or',['act',['term','"+"','expr'],1],
                'term']],
 ['def','term',['or',['act',['NUMBER'],2],
                ['act',['HOLE'],3],
                ['act',['"("','expr','")"'],4]]]];


var arithActions = doArith((_, ...actions) => actions);

var metaCompile = bootbnf.doBnf((_, action0, ..._2) => action0);

var arith0 = metaCompile(arithRules)(...arithActions);
  
testArith(arith0, 33, 44, 84);

testArith(doArith(bootbnf.doBnf(bootbnf)), 33, 44, 84);
