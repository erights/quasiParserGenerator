# quasiParserGenerator
A template string tag for generating template string tags.

A proof of concept for adapting parser generator tech to ES6 template
strings, where holes in the bnf are used for parser actions. The
meta-tag is called bnf, so bnf`grammar ${action}` for some grammar
and action will produce a tag for template strings written in
that grammar.
