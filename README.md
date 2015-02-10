We present a proof of concept template string tag for generating template string tags. See below for why this is only a proof of concept. There are many good serious parser generator frameworks out there, all of which are easily superior to the toy parser generator at the heart of this tag. The point of this project is not to provide an alternative to any of these, but rather to demonstrate how any of these technologies could be adapted to provide a template string tag for generating template string tags that could and should replace this project.

Nevertheless, until it is replaced, the template string tag for generating template string tags presented here is adequate for creating lots of useful little DSLs.

# A Template String Tag Generator

The input to our parser generator is expressed as a bnf template string, and the result is a template string tag for parsing template strings expressed in the grammar described by that bnf. The name of a template string tag usually names the language in which the template is written, which in our case is ```bnf.``` An example extracted from test/testbnf.es6:

```javascript
var bnf = require('../src/bootbnf.es6');

var arith = bnf`
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

arith`1 + (2 + ${3*11} + ${55-11}) + 4`;
// 84

```

By expressing the bnf grammar itself as a template string, we avoid an awkwardness nearly universal among parser generator input languages: the mixing of the language-independent bnf notation and the target-language-specific action rules. By contrast, our ```bnf``` template string tag only needs to parse bnf in the literal part of its template. The actions associated with each rule are provided using  ```${...}```substitution holes in the host language, as functions to be invoked during parsing of the template.

Each action rule takes as input the value associated with each of its input productions, and returns the value to be associated with its own production. The first bnf production is the start rule, and its value must be an n-ary function of the substitution values as arguments. The value returned by that function is the value of the template string expression as a whole.

The generated template string tag caches that n-ary start function on the template (the unchanging part of the template string expression), to be reused on each evaluation by applying it to the new substitution values. Thus, the parsing step only happens on first evaluation.

In the above ```arith``` grammar, each action returns such an n-ary function. The start production simply returns the n-ary function associated with ```expr```. The ```NUMBER``` and ```HOLE``` productions are built in token types of our proof of concept bnf grammar. ```NUMBER``` returns the string recognized the JSON production for "number". The action rule ```n => (..._) => JSON.parse(n)``` turns this into an n-ary function of substition values, which are ignored, returning the resulting number itself.

The ```HOLE``` production recognizes a substitution hole as a token type, and its value is the substitution hole number. The action rule ```h => (...subs) => subs[h]``` turns this into an n-ary function that returns the substition value provided for that hole.

The grammar for our bnf language, extracted from src/bootbnf.es6, expressed in itself, is

```javascript
  bnf`bnf ::= rule+ EOF              ${metaCompile};
      rule ::= IDENT "::=" body ";"  ${(name,_,body,_2) => ['def', name, body]};
      body ::= choice ** "|"         ${list => simple('or', list)};
      choice ::=
        term* HOLE                   ${(list,hole) => ['act', list, hole]}
      | seq;
      seq ::= term*                  ${list => simple('seq', list)};
      term ::=
        prim ("**" | "++") prim      ${(patt,q,sep) => [q, patt, sep]}
      | prim ("?" | "*" | "+")       ${(patt,q) => [q, patt]}
      | prim;
      prim ::=
        STRING | IDENT
      | "NUMBER" | "STRING" | "IDENT" | "HOLE" | "EOF"
      | "(" body ")"                 ${(_,b,_2) => b};
    `
```

where the action rules themselves only make sense within the context of src/bootbnf.es6.

The ```**``` operator is an infix generalization of the usual postfix ```*```, with the right operand recognized as the separator. For example, ```x ** ","``` recognizes ```x```'s separated by commas. The value is the list of values associated with the left (```x```) operand.

```NUMBER``` and ```STRING``` are both recognized using the corresponding JSON productions. ```IDENT``` is what you'd expect. ```EOF``` recognizes the end of input.

Quoted identifier are keywords, and are therefore not recognized by the IDENT production with that grammer. Other quoted strings are literal tokens, but currently, only if they fit within the cheezy rules for recognizing operator tokens. See src/scanner.es6 for the current specifics. Instead, the operator token recognizition for a given grammar should be based on which quoted strings actually appear in the grammar.


# Why is this only a proof of concept?

The lexer's rules and token types are built in.

The generated parser has most of the expense of a full backtracking parser with none of the correctness.

Ambiguous grammars are neither detected nor parsed correctly. Instead, the alternatives are tried in order (like a PEG), but an earlier successful match will not be backtracked because of later failures. In this toy, "|" is a prioritized committed choice. That's why, for example, the bare ```prim``` rule comes last above among the choices for ```term```.

Errors within the input to ```bnf``` are hard to debug.

Errors within the input to the generated tag (e.g., ```arith```) are hard to debug.

One issue with reporting good errors is unfixable, except by improving the template string mechanism is a future EcmaScript standard: The template string itself doesn't yet carry any source position information. If it did (e.g., ```template.sourceMap```), then template string tags could report errors in their input in terms of original source position. This would necessarily also expose code to its own source position, which is probably good.
