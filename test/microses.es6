// Options: --free-variable-checker --require --validate
module.exports = (function() {
  "use strict";

  const {bnf} = require('../src/bootbnf.es6');

  const binary = (left,rights) => rights.reduce((prev,[op,right]) => [op,prev,right], left);

  // const {Packratter} = require('../src/scanner.es6');
  // Packratter._debug = true;

  const microses = bnf`
    start ::= body EOF                                     ${(b,_) => ['script', b]};

    primaryExpr ::=
      (NUMBER / STRING / "null" / "true" / "false")        ${n => ['data',JSON.parse(n)]}
    / "[" arg ** "," "]"                                   ${(_,es,_2) => ['array',es]}
    / "{" prop ** "," "}"                                  ${(_,ps,_2) => ['object',ps]}
    / "(" expr ")"                                         ${(_,e,_2) => e}
    / quasiExpr
    / IDENT
    / HOLE                                                 ${h => ['exprHole',h]};

    pattern ::=
      (NUMBER / STRING / "null" / "true" / "false")        ${n => ['matchData',JSON.parse(n)]}
    / "[" param ** "," "]"                                 ${(_,ps,_2) => ['matchArray',ps]}
    / "{" propParam ** "," "}"                             ${(_,ps,_2) => ['matchObj',ps]}
    / IDENT                                                ${id => ['bind',id]}
    / HOLE                                                 ${h => ['patternHole',h]};

    arg ::=
      "..." expr                                           ${(_,e) => ['spread',e]}
    / expr;
    param ::=
      "..." pattern                                        ${(_,p) => ['rest',p]}
    / IDENT "=" expr                                       ${(id,_,e) => ['optional',id,e]}
    / pattern;

    prop ::=
      "..." expr                                           ${(_,e) => ['spreadObj',e]}
    / key ":" expr                                         ${(k,_,e) => ['prop',k,e]}
    / IDENT                                                ${id => ['prop',id,id]};
    propParam ::=
      "..." pattern                                        ${(_,p) => ['restObj',p]}
    / key ":" IDENT "=" expr                               ${(k,_,id,_2,e) => ['optionalProp',k,id,e]}
    / key ":" pattern                                      ${(k,_,p) => ['matchProp',k,p]}
    / IDENT "=" expr                                       ${(id,_,e) => ['optionalProp',id,id,e]}
    / IDENT                                                ${id => ['matchProp',id,['bind',id]]};

    key ::= IDENT / STRING;

    quasiExpr ::=
      QUASI_ALL
    / QUASI_HEAD (expr (QUASI_MID expr)*)? QUASI_TAIL      ${(h,pairs,tail) => ['quasi',h,pairs,t]};

    later ::= NO_NEWLINE "!";

    postExpr ::= primaryExpr postOp*                       ${binary};
    postOp ::=
      "." IDENT                                            ${(_,id) => ['get',id]}
    / "[" expr "]"                                         ${(_,e,_2) => ['index',e]}
    / "(" arg ** "," ")"                                   ${(_,args,_2) => ['call',args]}
    / quasiExpr                                            ${q => ['tag',q]}

    / later IDENT                                          ${(_,id) => ['getLater',id]}
    / later "[" expr "]"                                   ${(_,_2,e,_3) => ['indexLater',e]}
    / later "(" arg ** "," ")"                             ${(_,_2,args,_3) => ['callLater',args]}
    / later quasiExpr                                      ${(_,q) => ['tagLater',q]};

    preExpr ::=
      preOp preExpr                                        ${(op,e) => [op,e]}
    / postExpr;
    preOp ::= "void" / "typeof" / "+" / "-" / "!";

    powExpr ::= preExpr ("**" powExpr)?                    ${binary};
    multExpr ::= powExpr (("*" / "/" / "%") powExpr)*      ${binary};
    addExpr ::= multExpr (("+" / "-") multExpr)*           ${binary};
    relExpr ::= addExpr (relOp addExpr)?                   ${binary};
    relOp ::= "<" / ">" / "<=" / ">=" / "===" / "!==";
    andThenExpr ::= relExpr ("&&" relExpr)*                ${binary};
    orElseExpr ::= andThenExpr ("||" andThenExpr)*         ${binary};

    expr ::=
      lValue assignOp expr                                 ${(lv,op,rv) => [op,lv,rv]}
    / arrow
    / orElseExpr;

    lValue ::=
      IDENT
    / primaryExpr "[" expr "]"                             ${(pe,_,e,_2) => ['index',pe,e]}
    / primaryExpr later "[" expr "]"                       ${(pe,_,_2,e,_3) => ['indexLater',pe,e]};

    assignOp ::= "=" / "*=" / "/=" / "%=" / "+=" / "-=";

    arrow ::=
      params NO_NEWLINE "=>" block                         ${(ps,_,_2,b) => ['arrow',ps,b]}
    / params NO_NEWLINE "=>" expr                          ${(ps,_,_2,e) => ['lambda',ps,e]};
    params ::=
      IDENT                                                ${id => [id]}
    / "(" param ** "," ")"                                 ${(_,ps,_2) => ps};

    statement ::=
      block
    / "if" "(" expr ")" block "else" block                 ${(_,_2,c,_3,t,_4,e) => ['if',c,t,e]}
    / "if" "(" expr ")" block                              ${(_,_2,c,_3,t) => ['if',c,t]}
    / "for" "(" declaration expr? ";" expr? ")" block      ${(_,_2,d,c,_3,i,_4,b) => ['for',d,c,i,b]}
    / "for" "(" declaration "of" expr ")" block            ${(_,_2,d,_3,e,_4,b) => ['forOf',d,e,b]}
    / "while" "(" expr ")" block                           ${(_,_2,c,_3,b) => ['while',c,b]}
    / "try" block catcher finalizer                        ${(_,b,c,f) => ['try',b,c,f]}
    / "try" block finalizer                                ${(_,c,f) => ['try',b,f]}
    / "try" block catcher                                  ${(_,b,c,f) => ['try',b,c]}
    / "switch" "(" expr ")" "{" branch* "}"                ${(_,_2,e,_3,_4,bs,_5) => ['switch',e,bs]}
    / terminator
    / "debugger" ";"                                       ${(_,_2) => ['debugger']}
    / expr ";"                                             ${(e,_) => e}
    /                                                      ${() => ['empty']};

    terminator ::=
      "return" NO_NEWLINE expr ";"                         ${(_,_2,e,_3) => ['return',e]}
    / "return" ";"                                         ${(_,_2) => ['return']}
    / "break" ";"                                          ${_ => ['break']}
    / "throw" expr ";"                                     ${(_,e,_2) => ['throw',e]};

    declaration ::= declOp (pattern "=" expr) ** "," ";"   ${(op,decls,_) => [op, decls]};
    declOp ::= "var" / "const" / "let";

    catcher ::= "catch" "(" pattern ")" block              ${(_,_2,p,_3,b) => ['catch',p,b]};
    finalizer ::= "finally" block                          ${(_,b) => ['finally',b]};

    branch ::= caseLabel+ "{" body terminator "}"          ${(cs,_,b,t,_2) => ['branch',cs,[...b,t]]};
    caseLabel ::=
      "case" expr ":"                                      ${(_,e) => ['case', e]}
    / "default" ":"                                        ${(_,_2) => ['default']};

    block ::= "{" body "}"                                 ${(_,b,_2) => ['block', b]};
    body ::= (statement / declaration)*;
  `;
}());
