var to5 = require('6to5');
var sc = require('./scanner.es6');

module.exports = (function(){
  "use strict";

  // TODO: Should test if in SES, and use SES's def if so.
  const def = Object.freeze;

  // TODO: Should test if in SES, and use SES's confine if so.
  function confine(expr, env) {
    var names = Object.getOwnPropertyNames(env);
    var closedFuncSrc = 
`(function(${names.join(',')}) {
  "use strict";
  return ${expr};
})`
    closedFuncSrc = to5.transform(closedFuncSrc).code;
    // The following line should invoke "(1,eval)", i.e., the
    // indirect eval function, rather than the direct eval
    // operator. However, io.js in strict mode incorrectly
    // issues the following error:
    // "SyntaxError: Unexpected eval or arguments in strict mode"
    var closedFunc = eval(closedFuncSrc);
    return closedFunc(...names.map(n => env[n]));
  }

  function quasiMemo(quasiCurry) {
    const wm = new WeakMap();
    return function(template, ...subs) {
      var quasiRest = wm.get(template);
      if (!quasiRest) {
        quasiRest = quasiCurry(template);
        wm.set(template, quasiRest);
      }
      if (typeof quasiRest !== 'function') {
        throw new Error(`${typeof quasiRest}: ${quasiRest}`);
      }
      return quasiRest(...subs);
    }
  }
  
  
  function simple(prefix, list) {
    if (list.length === 0) { return ['empty']; }
    if (list.length === 1) { return list[0]; }
    return [prefix, ...list];
  }
  
  function indent(str, newnewline) {
    return str.replace(/\n/g, newnewline);
  }
  
  function compile(sexp) {
    var numSubs = 0;
    const tokenTypes = new Set();
  
    // generated names
    // act_${i}      action parameter
    // rule_${name}  function from bnf rule
    // seq_${i}      sequence success label
    // or_${i}       choice failure label
    // pos_${i}      backtrack token index
    // s_${i}        accumulated list of values
    // v_${i}        set to s_${i} on fall thru path

    var alphaCount = 0;
    // TODO(erights): Use lexical "let" once FF supports it.
    const vars = ['var value = FAIL'];
    function nextVar(prefix) {
      const result = `${prefix}_${alphaCount++}`;
      vars.push(result);
      return result;
    }
    function takeVarsSrc() {
      const result = `${vars.join(', ')};`;
      vars.length = 1;
      return result;
    }
    function nextLabel(prefix) {
      return `${prefix}_${alphaCount++}`;
    }
  
  
    function peval(sexp) {
      const vtable = Object.freeze({
        bnf: function(...rules) {
          // The following line also initializes tokenTypes and numSubs
          const rulesSrc = rules.map(peval).join('');
  
          const paramSrcs = [];
          for (var i = 0; i < numSubs; i++) {
            paramSrcs.push(`act_${i}`)
          }
          const tokenTypeListSrc = 
                `[${[...tokenTypes].map(tt => JSON.stringify(tt)).join(', ')}]`;
          return (
`(function(${paramSrcs.join(', ')}) {
  return function(template) {
    const scanner = new Scanner(template.raw, ${tokenTypeListSrc});
    const FAIL = sc.FAIL;
    ${indent(rulesSrc,`
    `)}
    return rule_${rules[0][1]}();
  };
})
`);
        },
        def: function(name, body) {
          // The following line also initializes vars
          const bodySrc = peval(body);
          return (
`function rule_${name}() {
  ${takeVarsSrc()}
  ${indent(bodySrc,`
  `)}
  return value;
}
`);
        },
        empty: function() {
          return `value = [];`;
        },
        fail: function() {
          return `value = FAIL;`;
        },
        or: function(...choices) {
          const labelSrc = nextLabel('or');
          const choicesSrc = choices.map(peval).map(cSrc =>
`${cSrc}
if (value !== FAIL) break ${labelSrc};`).join('\n');

        return (
`${labelSrc}: {
  ${indent(choicesSrc,`
  `)}
}`);
        },
        seq: function(...terms) {
          const posSrc = nextVar('pos');
          const labelSrc = nextLabel('seq');
          const sSrc = nextVar('s');
          const vSrc = nextVar('v');
          const termsSrc = terms.map(peval).map(termSrc =>
`${termSrc}
if (value === FAIL) break ${labelSrc};
${sSrc}.push(value);`).join('\n');
  
          return (
`${sSrc} = [];
${vSrc} = FAIL;
${posSrc} = scanner.pos;
${labelSrc}: {
  ${indent(termsSrc,`
  `)}
  ${vSrc} = ${sSrc};
}
if ((value = ${vSrc}) === FAIL) scanner.pos = ${posSrc};`);
        },
        act: function(terms, hole) {
          numSubs = Math.max(numSubs, hole + 1);
          const termsSrc = vtable.seq(...terms);
          return (
`${termsSrc}
if (value !== FAIL) value = act_${hole}(...value);`);
        },
        '**': function(patt, sep) {
          const posSrc = nextVar('pos');
          const sSrc = nextVar('s');
          const pattSrc = peval(patt);
          const sepSrc = peval(sep);
          return (
// after first iteration, backtrack to before the separator
`${sSrc} = [];
${posSrc} = scanner.pos;
while (true) {
  ${indent(pattSrc,`
  `)}
  if (value === FAIL) {
    scanner.pos = ${posSrc};
    break;
  }
  ${sSrc}.push(value);
  ${posSrc} = scanner.pos;
  ${indent(sepSrc,`
  `)}
  if (value === FAIL) break;
}
value = ${sSrc};`);
        },
        '++': function(patt, sep) {
          const starSrc = vtable['**'](patt, sep);
          return (
`${starSrc}
if (value.length === 0) value = FAIL;`);
        },
        '?': function(patt) {
          return vtable['**'](patt, ['fail']);
        },
        '*': function(patt) {
          return vtable['**'](patt, ['empty']);
        },
        '+': function(patt) {
          return vtable['++'](patt, ['empty']);
        }
      });
  
      if (typeof sexp === 'string') {
        if (sc.allRE(sc.STRING_RE).test(sexp)) {
          tokenTypes.add(sexp);
          return `value = scanner.eat(${sexp});`;
        }
        if (sc.allRE(sc.IDENT_RE).test(sexp)) {
          switch (sexp) {
            case 'NUMBER': {
              tokenTypes.add(sexp);
              return `value = scanner.eatNUMBER();`;
            }
            case 'STRING': {
              tokenTypes.add(sexp);
              return `value = scanner.eatSTRING();`;
            }
            case 'IDENT': {
              tokenTypes.add(sexp);
              return `value = scanner.eatIDENT();`;
            }
            case 'HOLE': {
              return `value = scanner.eatHOLE();`;
            }
            case 'EOF': {
              return `value = scanner.eatEOF();`;
            }
            default: {
              // If it isn't a bnf keyword, assume it is a rule name.
              return `value = rule_${sexp}();`;
            }
          }
        }
        throw new Error('unexpected: ' + sexp);
      }        
      return vtable[sexp[0]](...sexp.slice(1));
    }
  
    return peval(sexp);
  }

  function metaCompile(baseRules, _=void 0) {
    var baseAST = ['bnf', ...baseRules];
    var baseSrc = compile(baseAST);
    var baseParser = confine(baseSrc, {
      Scanner: sc.Scanner
    });
    return function(...baseActions) {
      var baseCurry = baseParser(...baseActions);
      return quasiMemo(baseCurry);
    };
  }

  function doBnf(bnf) {
    return bnf`
      bnf ::= rule+ EOF              ${metaCompile};
      rule ::= IDENT "::=" body ";"  ${(name,_,body,_2) => ['def', name, body]};
      body ::= choice ** "|"         ${list => simple('or', list)};
      choice ::=
        seq HOLE                     ${(list,hole) => ['act', list, hole]}
      | seq                          ${list => simple('seq', list)};
      seq ::= term*;
      term ::= 
        prim ("**" | "++") prim      ${(patt,q,sep) => [q, patt, sep]}
      | prim ("?" | "*" | "+")       ${(patt,q) => [q, patt]}
      | prim;
      prim ::=
        STRING | IDENT
      | "NUMBER" | "STRING" | "IDENT" | "HOLE" | "EOF"
      | "(" body ")"                 ${(_,b,_2) => b};
    `;
  }    
  
  var bnfRules = [
   ['def','bnf',['act',[['+','rule'],'EOF'], 0]],
   ['def','rule',['act',['IDENT','"::="','body','";"'], 1]],
   ['def','body',['act',[['**','choice','"|"']], 2]],
   ['def','choice',['or',['act',['seq','HOLE'], 3],
                    ['act',['seq'], 4]]],
   ['def','seq',['*','term']],
   ['def','term',['or',['act',['prim',['or','"**"','"++"'],'prim'], 5],
                  ['act',['prim',['or','"?"','"*"','"+"']], 6],
                  'prim']],
   ['def','prim',['or','STRING','IDENT',
                  '"NUMBER"','"STRING"','"IDENT"','"HOLE"','"EOF"',
                  ['act',['"("','body','")"'], 7]]]];
  
  var bnfActions = doBnf((_, ...actions) => actions);
  
  var bootbnf = metaCompile(bnfRules)(...bnfActions);
  bootbnf.doBnf = doBnf;
 
  return def(bootbnf);
}());
