const bnf = require('../src/bootbnf.es6');

function doArith(bnfParam) {
  return bnfParam`
    start ::= expr EOF  ${(v,_) => v};
    expr ::=
      term "+" expr     ${(a,_,b) => (...subs) => a(...subs) + b(...subs)}
    | term;
    term ::=
      NUMBER            ${n => (..._) => JSON.parse(n)}
    | HOLE              ${h => (...subs) => subs[h]}
    | "(" expr ")"      ${(_,v,_2) => v};
   `;
}

const arith = doArith(bnf);

function testArith(arith) {
  if (arith`1 + (2 + ${3*11} + ${55-11}) + 4` !== 84) {
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

const metaCompile = bnf.doBnf((_, action0, ..._2) => action0);

const arith0 = metaCompile(arithRules)(...arithActions);

testArith(arith0);

testArith(doArith(bnf.doBnf(bnf)));




const subArith = bnf.extends(arith)`
  expr ::=
    term "-" expr     ${(a,_,b) => (...subs) => a(...subs) - b(...subs)}
  | super.expr;
`;



// Note: right associative, so currently the right answer is -4.
if (subArith`1 + 2 - 3 + 4` !== -4) {
  throw new Error('Possible problem with grammar inheritance');
}

