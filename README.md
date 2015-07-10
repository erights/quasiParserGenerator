We present a template string tag for generating template string tags. The template string tag for generating template string tags presented here is already adequate for creating lots of useful little DSLs. However, see the list of qualifications at the end.

This project owes a huge debt to OMeta, which I repeatedly turned to as questions arose. However, this project is much less ambitious in a number of ways.

# A Template String Tag Generator

The input to our parser generator is expressed as a bnf template string, and the result is a template string tag for parsing template strings expressed in the grammar described by that bnf. The name of a template string tag usually names the language in which the template is written, which in our case is ```bnf.``` An example extracted from test/testbnf.es6:

```javascript
var bootbnf = require('../src/bootbnf.es6');
var bnf = bootbnf.bnf;

var arith = bnf`
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

arith`1 + (2 + ${3*11} + ${55-11}) + 4`;
// 84

```

By expressing the bnf grammar itself as a template string, we avoid an awkwardness nearly universal among parser generator input languages: the mixing of the language-independent bnf notation and the host-language-specific action rules. By contrast, our ```bnf``` template string tag only needs to parse bnf in the literal part of its template. The actions associated with each rule are provided using  ```${...}```substitution holes in the host language, as functions to be invoked during parsing of the template.

Each action rule takes as input the value associated with each of its input productions, and returns the value to be associated with its own production. The first bnf production is the start rule, and its value must be an n-ary function of the substitution values as arguments. The value returned by that function is the value of the template string expression as a whole.

The generated template string tag caches that n-ary start function on the template (the unchanging part of the template string expression), to be reused on each evaluation by applying it to the new substitution values. Thus, the parsing step only happens on first evaluation.

In the above ```arith``` grammar, each action returns such an n-ary function. The start production simply returns the n-ary function associated with ```expr```. The ```NUMBER``` and ```HOLE``` productions are built in token types of our proof of concept bnf grammar. ```NUMBER``` returns the string recognized by the JSON production for "number". The action rule ```n => (..._) => JSON.parse(n)``` turns this into an n-ary function of substition values, which are ignored, returning the resulting number itself.

The ```HOLE``` production recognizes a substitution hole as a token type, and its value is the substitution hole number. The action rule ```h => (...subs) => subs[h]``` turns this into an n-ary function that returns the substition value provided for that hole.

The grammar for our bnf language, extracted from src/bootbnf.es6, expressed in itself, is

```javascript
  bnf`start ::= rule+ EOF            ${metaCompile};
      rule ::= IDENT "::=" body ";"  ${(name,_,body,_2) => ['def', name, body]};
      body ::= choice ** "/"         ${list => simple('or', list)};
      choice ::=
        seq HOLE                     ${(list,hole) => ['act', list, hole]}
      / seq                          ${list => simple('seq', list)};
      seq ::= term*;
      term ::=
        prim ("**" / "++") prim      ${(patt,q,sep) => [q, patt, sep]}
      / prim ("?" / "*" / "+")       ${(patt,q) => [q, patt]}
      / prim;
      prim ::=
        "super" "." IDENT            ${(sup,_2,id) => [sup, id]}
      / "this" "." HOLE              ${(_,_2,hole) => ['apply', hole]
      / IDENT / STRING
      / "(" body ")"                 ${(_,b,_2) => b};
    `
```

where the action rules themselves only make sense within the context of src/bootbnf.es6.

The ```**``` operator is an infix generalization of the usual postfix ```*```, with the right operand recognized as the separator. For example, ```x ** ","``` recognizes ```x```'s separated by commas. The value is the list of values associated with the left (```x```) operand.

```NUMBER``` and ```STRING``` are both recognized using the corresponding JSON productions. ```IDENT``` is what you'd expect. ```EOF``` recognizes the end of input.

Quoted identifiers are keywords, and are therefore not recognized by the ```IDENT``` production within that grammer. Other quoted strings are literal tokens, but currently, only if they fit within the cheezy rules for recognizing operator tokens. See src/scanner.es6 for the current specifics. Instead, the operator token recognition for a given grammar should be based on which quoted strings actually appear in the grammar.

# Grammar Inheritance

In addition to the rules it defines, our bnf grammar's own self description uses the identifiers ```EOF``` ,```IDENT```,  ```HOLE```, and ```STRING```. However, the only keyword it defines in ```"super"``` which it does not use. The reason is that this grammar inherits from ```bootbnf.defaultBaseGrammar```. The ```defaultBaseGrammar``` provides the rules for ```EOF``` ,```IDENT```,  ```HOLE```, and ```STRING```, as well as the expected rule for ```NUMBER```. The tags defined by the ```bnf``` tag also inherit from ```bootbnf.defaultBaseGrammar``` by default.

The ```bnf``` tag also has an ```extends``` method for specifying a base grammar explicitly. For example, test/testbnf.es6 defines a bnf grammar for JSON called ```QuasiJSON```. The relevant parts are

```javascript
const QuasiJSON = bnf`
  start ::= value EOF     ${(v,_) => v};
  ...
  record ::= "{" (key ":" value) ** "," "}" ...;
  ...
  key ::= 
    STRING                ${p => (..._) => JSON.parse(p)}
  / HOLE                  ${h => (...subs) => subs[h]};
`;

```

As with actual JSON, this grammar has the irritating feature that keys of records must be quoted strings. We can create a new grammar that extends this grammar so that identifiers can appear as keys without quotation:

```javascript
const JSONPlus = bnf.extends(QuasiJSON)`
  start ::= super.start;
  key ::=
    super.key
  / IDENT                 ${id => (..._) => id};
`;
```

The ```bnf.extends(QuasiJSON)``` expression produces a template string tag, like the bnf tag itself, except that it defines a grammar that inherits from ```QuasiJSON``` rather than ```defaultBaseGrammar```. Within this derived grammar, the production name ```super.key``` refers to the ```key``` production of the base grammar. In the context of the derived grammar, unqualified references in the base grammar to the ```key``` production refer to the derived grammar's overriding ```key``` production.

Grammar inheritance is implemented by ES6 (aka EcmaScript 2015) class inheritance. Each grammar defined by these mechanisms has a ```Parser``` property whose value is the actual class for that tag's parser. For example, ```bnf.Parser``` is a parser class that inherits from the ```defaultBaseGrammar.Parser``` class and does the actual parsing work of our ```bnf``` tag.

# What is Missing?

Our grammar is essentially a PEG (Parsing Expression Grammar), where "```/```" is a prioritied choice operator and backtracking happens only within a rule. Our parsers do packrat memoization, which should result in linear parse times.

  * No support for left recursion.
  * No support for parameterized rules.
  * No support for positive or negative lookahead.
  * No support for exclusive choice.
  * Errors within the input to ```bnf``` are hard to debug.
  * Errors within the input to the generated tag (e.g., ```arith```) are hard to debug.

All these issues might improve with time, especially by studying and borrowing mechanism from OMeta. In particular, having the full memo table available should enable us to report better errors.

One issue with reporting good errors is unfixable, except by improving the template string mechanism in a future EcmaScript standard: The template string itself doesn't yet carry any source position information. If it did (e.g., ```template.sourceMap```), then template string tags could report errors in their input in terms of original source position. This would necessarily also expose code to its own source position, which is probably good.
