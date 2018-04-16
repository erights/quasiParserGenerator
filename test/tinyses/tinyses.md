  // ////////////////  Subsetting EcmaScript 2017  /////////////


One language is a *static subset* (S) of another if every program
statically accepted by the smaller language is also statically
accepted by the larger language with the same meaning.

One language is a *dynamic subset* (D) of another if
non-erroneous execution of code in the smaller language would
operate the same way in the larger language.

One language is *absorbed* (A) by another if code in the smaller
language can be run as code in the larger language without
internal modification. (Surrounding the code with a prelude and
postlude is a modification, but not an *internal modification*.)
A smaller language which is not absorbed may often be
*transpiled* (T) into the larger language by source-to-source
transformation.

JSON <SA TinySES <SA SES <DA ES2017-strict <SDA ES2017

Each step needs to be explained. Proceeding from right to left.

EcmaScript code may be in either strict code or sloppy code, so
the strict sublanguage is a static, dynamic, absorbed subset of
full EcmaScript by definition. (In addition, the strict
sublanguage started by approximating a static and dynamic subset
of the sloppy language, excluding "with" and throwing errors
where the sloppy language would instead silently act insane. But
this approximation is no longer useful because of its many
exceptions.)

SES is a dynamic, absorbed subset of ES2017-strict. SES
statically accepts all programs accepted by ES2017-strict and can
run on ES2017-strict without internal modification.  SES freezes
the primordials, so mutations that would succeed in ES2017-strict
might instead throw a TypeError in SES.  SES restricts the global
scope, so attempts to dereference a variable named, for example,
"document" that might succeed in ES2017-strict on a given host
might instead throw a ReferenceError in within a SES environment
run on that host.

SES is the largest subset of ES2017-strict which is still an ocap
language. Its purpose is to run as many conventional EcmaScript
programs as possible while staying within ocap rules.

(ES2017-strict does not include the import expression or the
import.meta expression. Once ES20xx-strict does include these,
SES must either exclude these by becoming a static subset,
or it must restrict their semantics, require transpilation if
embedded into the full language. Either embedding requires a
full parse.)

TinySES is a static, absorbed subset of SES. TinySES approximates
the smallest useful subset of SES that is still pleasant to
program in using the objects-as-closures pattern. TinySES omits
"this" and classes. Once initialized, the API surface of a TinySES
object must be tamper-proofed before exposure to clients.
TinySES is not intended to run legacy code or code that uses
inheritance.

The TinySES grammar is simple enough to be parsed easily. TinySES
imposes static validation rules that are easy to check locally,
to ensure that objects are tamper-proofed before they escape.
Statically valid TinySES programs enable sound static analysis of
useful safety properties. A SES IDE can thereby flag which code
is in TinySES and provide static analysis info for that code.

Used outside of SES, TinySES can be implemented (compiled or
interpreted) easily and with high confidence.

JSON is a static, absorbed subset of all the languages above.

Starting from this chain of subsetting, orthogonal extensions
include typing and distribution. It is possible that typed
TinySES can be soundly statically typed without implicit runtime
checks, but we have not yet investigated this. Distributed
messages are likely to be typed, hopefully using the same type
system.


/////////////   TinySES as syntactic subset of SES  ///////////


The following TinySES grammar is based on
(http://www.ecma-international.org/ecma-262/8.0/#sec-grammar-summary).
Unlike that page, lexical productions are named in all upper
case.

Unlike ES2017 and SES, TinySES has no semicolon insertion, and so
does not need a parser able to handle that. However, TinySES must
impose the NO_NEWLINE constraints from ES2017, so that every
non-rejected TinySES program is accepted as the same SES
program. NO_NEWLINE is a lexical-level placeholder that must
never consume anything. It should fail if the whitespace to skip
over contains a newline. TODO: Currently this placeholder always
succeeds.

TinySES omits the RegularExpressionLiteral, instead including the
RegExp.make https://github.com/mikesamuel/regexp-make-js template
string tag. By omitting RegularExpressionLiteral and automatic
semicolon insertion, our lexical grammar avoids the context
dependence that plague JavaScript lexers.

In TinySES, all reserved words are unconditionally reserved. By
contrast, in ES2017 and SES, "yield", "await", "implements", etc are
conditionally reserved. Thus we avoid the need for parameterized
lexical-level productions.

TinySES omits both the "in" expression and the for/in loop,
and thus avoids the need for parameterized parser-level
productions.

QUASI_* are lexical-level placeholders. QUASI_ALL should match a
self-contained template literal string that has no holes
" `...`". QUASI_HEAD should match the initial literal part of a
template literal with holes " `...${ ". QUASI_MID should match
the middle " }...${ ", and QUASI_TAIL the end " }...` ". The
reason these are difficult is that a "}" during a hole only
terminates the hole if it is balanced.  TODO: All these
placeholders currently fail.

Ouside the lexical grammar, other differences from
http://www.ecma-international.org/ecma-262/8.0/#sec-grammar-summary
are noted as comments within the grammar below.  That page uses a
cover grammar to avoid unbounded lookahead. Because the grammar
here is defined using a PEG (parsing expression grammar) which
supports unbounded lookahead, we avoid the need for a cover
grammar.

TinySES array literals omit elision (i.e., nothing between
commas).

TinySES treats "arguments" and "eval" as reserved keywords.
Strict mode already limits "arguments" and "eval" to the point
that they are effectively keywords in strict code.  TinySES does
include "..." both as rest and spread which provides the useful
functionality of "arguments" with less confusion.  The
EcmaScript/strict "eval" can be used for both direct and indirect
eval. TinySES has no direct eval and can use other evaluator APIs
to partially make up the difference.

TinySES omits computed property names. TinySES has syntax for
mutating only number-named properties, which include floating
point, "NaN", "Infinity", and "-Infinity". TinySES omits syntactic
support for mutating other property names. TinySES has syntax for
computed lookup and mutation of number-named properties, but not
other property names.

TinySES includes arrow functions, "function" functions, concise
method syntax, and accessor (getter / setter) syntax.
TinySES may eventually grow to accept generators, async
functions, async iterator functions, all in their "function", arrow,
and method form. TinySES does not support symbols or general
computed property access, but may grow to as well, once we
understand its impact on static analyzability. However,
TinySES will continue to omit "this" as the central defining
difference between SES and TinySES. TinySES will therefore continue
to omit "class" as well.

Beyond subsetting ES2017, this grammar also includes the infix "!"
(eventually) operator from Dr.SES. We hope infix "!" eventually
becomes part of the standard EcmaScript grammar. But even if not,
infix "!" trivially transpiles into calls to the Dr.SES extended
promise API. See (http://research.google.com/pubs/pub40673.html).


/////// TinySES as a semantic, transpiled subset of SES ////////

TinySES freezes object literals and function literals by
default. Aside from Proxies, only frozen objects can have a
defensive API surface, since any client with direct access
may freeze them, disrupting assumptions. Freezing makes the API
tamper proof. But objects and functions can still easily express
mutable abstractions by capturing mutable lexical variables.

Should TinySES include assignment to fieldExpr as well as the
syntax for accessor properties? Assuming defensive objects are
frozen anyway, this introduces no hazards while allowing more
conventional-looking APIs.

A TinySES "function" function is not intended to be used as a
constructor. To prevent a client from causing confusion by
calling it as a constructor, TinySES "function" functions are
transpiled to hoisted "const" declarations initialized to arrow
functions, which works since TinySES omits "this" and
"arguments".
Note that a client with access to ObSES "function" function f
cannot actually do any more mischief than they could have done
for themselves anyway, so perhaps this transformation isn't
really needed anyway?
TODO: Besides "this" and "arguments", how else might an arrow
function differ from a "function" function?

It is unclear how TinySES should treat array literals. Unlike
objects, arrays cannot hide their mutable state behind an API that
is still pleasant. The square bracket index syntax is too
compelling. However, a non-frozen array is not defensive since
any client can freeze it. Ideomatic use of arrays makes pervasive
use of their ability to grow, so we cannot even protect them by
"seal" or "preventExtensions".

Currently, TinySES does not automatically freeze arrays, leaving
it to the programmer to do so before exposing them to
clients. Perhaps we can use static analysis to alert the
programmer where they may have failed to do so?

Open type questions: Assuming we somehow restrict arrays to
array-like usage, can TinySES be soundly statically typed with a
structural type system? What about trademarks/nominal-types and
auditors? How would this map to the wasm type system which does tag
checking but no deep parameterized type checking?  If static
checking makes sense, should we add some of TypeScript's or Flow's
syntax for optional type declarations?  Given function types
(parameter and return value), can the rest generally be inferred?
How would these types play with the Cap'n Proto types? What about
subtyping? What about contravariance?

TODO: Alternate approach: rather than freeze automatically, have
static analysis catch cases where non-frozen values may leak to
clients or code outside the current module. We might still freeze
functions and seal non-array objects anyway, for
defense-in-depth. But this would allow us to make use of mutable
arrays for internal calculations as well as frozen arrays for
communication. If we do this, we should allow assignment to field
expressions both for sealed mutable unreleased objects as well as
for accessor properties.
