// Options: --free-variable-checker --require --validate
/*global module require*/

module.exports = (function() {
  "use strict";

  const {def} = require('../../src/sesshim.js');
  const {bnf} = require('../../src/bootbnf.js');

  const binary = (left,rights) => rights.reduce((prev,[op,right]) => [op,prev,right], left);

  const qunpack = (h,ms,t) => {
    const result = [h];
    if (ms.length === 1) {
      const [[m,pairs]] = ms;
      result.push(m);
      for (let [q,e] of pairs) {
        result.push(q,e);
      }
    }
    result.push(t);
    return result;
  };

  const {FAIL, Packratter} = require('../../src/scanner.js');
  // Packratter._debug = true;


  const chainmail = bnf`

    start ::= body EOF                                     ${(b,_) => (..._) => ['script', b]};
    body ::= spec*;

    useVar ::= IDENT                                       ${id => ['use',id]};
    defVar ::= IDENT                                       ${id => ['def',id]};
    typeDecl ::= ":" type                                  ${(_,type) => ['type',type]};
    type ::= useVar;

    spec ::= 
      "specification" defVar "{" field* policy* "}"        ${(_,id,_2,pols,_3) => ['spec',id,pols]};

    field ::= "field" defVar typeDecl? ";"                 ${(_,id,optType,_2) => ['field',id,optType]};

    policy ::= 
      code ";"
    / code "{" pre? success? failure? "}"                  ${(code,_,optPre,optS,optF,_2) => ['policy',code,optPre,optS,optF]};

    code ::=
      "method" defVar "(" param ** "," ")"                 ${(_,id,_2,params,_3) => ['method',id,params]}
    / "always"                                             ${_ => ['always']};

    pre ::= "if" conds                                     ${(_,conds) => ['pre',conds]};
    success ::= "success" "implies" conds                  ${(_,_2,conds) => ['success',conds]};
    failure ::= "failure" "implies" conds                  ${(_,_2,conds) => ['failure',conds]};

    conds ::= "{" cond* "}"                                ${(_,conds,_2) => conds};

    cond ::=
      "not" conds                                          ${(_,conds) => ['not',conds]}
    / "forall" (param ++ ",") conds                        ${(_,params,conds) => ['forall',params,conds]}
    / "exists" (param ++ ",") conds                        ${(_,params,conds) => ['exists',params,conds]}
    / expr "obeys" typeExpr                                ${(expr,_,typeExpr) => ['obeys',expr,typeExpr]}
    / expr;

    expr ::=
      primExpr
    / "pre" primExpr                                       ${(_,e) => ['preVal',e]}
    / expr "(" expr ** "," ")"                             ${(base,_,args,_2) => ['call',base,args]}
    / primExpr op primExpr                                 ${(left,op,right) => [op,left,right]};

    primExpr ::=
      useVar
    / primExpr "." useVar                                  ${(base,_,field) => ['dot',base,field]}
    / "(" cond ")"                                         ${(_,e,_2) => e};

    op ::=
      "and" / "or" / "implies"
    / "<" / "<=" / "===" / "!==" / ">=" / ">"
    / "+" / "-";

`;

  return def({chainmail});
}());
