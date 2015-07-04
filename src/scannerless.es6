// Options: --free-variable-checker --require --validate
module.exports = (function(){
  "use strict";

  const {def} = require('./sesshim.es6');
  const {FAIL, EOF,
    SPACE_RE, NUMBER_RE, STRING_RE, IDENT_RE,
    LINE_COMMENT_RE, stickyRE,
    Pos, Packratter} = require('./scanner.es6');
  const {quasifyParser, bnf} = require('./bootbnf.es6');

  /**
   * The base Parser class for parser traits to extend in order to
   * define scannerless parsers. This class functions as a degenerate
   * Lexer whose "tokens", so to speak, are either<ul>
   * <li>a character,
   * <li>a hole number,
   * <li>EOF
   * </ul>
   */
  class BaseScannerless extends Packratter {
    constructor(template) {
      super();
      this.template = template;
    }
    start() {
      const result = [];
      const numSubs = this.template.length - 1;
      for (let segnum = 0; segnum <= numSubs; segnum++) {
        result.push(...this.template[segnum]);
        if (segnum < numSubs) {
          result.push(segnum);  // as hole number
        }
      }
      return result;
    }
    find(pos) {
      const numSubs = this.template.length - 1;
      let relpos = pos;
      for (let segnum = 0; segnum <= numSubs; segnum++) {
        const segment = this.template[segnum];
        const seglen = segment.length;
        if (relpos < seglen) {
          return [segnum, relpos];
        } else if (relpos === seglen && segnum < numSubs) {
          return segnum;  // as hole number
        }
        relpos -= seglen + 1; // "+1" for the skipped hole
      }
      return EOF;
    }
    syntaxError() {
      console.log(`
-------template--------
${JSON.stringify(this.template, void 0, ' ')}
-------`);
      const [last, fails] = this.lastFailures();
      const found = find(last);
      // TODO need better diagnostic info. See syntaxError in Scanner.
      let tokStr = `unexpected at ${last}`;
      if (found === EOF) {
        tokStr = `Unexpected EOF`;
      } else if (Array.isArray(found)) {
        tokStr = `${found[0]}:${found[1]}`;
      } else if (typeof found === 'number') {
        tokStr = `hole ${found}`;
      }
      const failStr = fails.length === 0 ? 
        `stuck` : `looking for ${fails.join(' ')}`;
      throw new SyntaxError(`${tokStr} ${failStr}`);
    }
    // Meant to be overridden, but must always succeed
    // Callers should not memoize calls to rule_SKIP as it is likely
    // not worth it.
    rule_SKIP(pos) {
      return [pos, ''];
    }
    eat(pos, patt) {
      [pos] = this.rule_SKIP(pos);
      const found = this.find(pos);
      if (Array.isArray(found)) {
        const segment = this.template[found[0]];
        if (typeof patt === 'string') {
          if (segment.startsWith(patt, found[1])) {
            return [pos + patt.length, patt];
          }
        }
      }
      return [pos, FAIL];
    }
    rule_CHAR(pos) {
      [pos] = this.rule_SKIP(pos);
      const found = this.find(pos);
      if (Array.isArray(found)) {
        return [pos + 1, this.template[found[0]][found[1]]];
      }
      return [pos, FAIL];
    }
    rule_HOLE(pos) {
      [pos] = this.rule_SKIP(pos);
      const found = this.find(pos);
      if (typeof found === 'number') { return [pos + 1, found]; }
      return [pos, FAIL];
    }
    rule_EOF(pos) {
      [pos] = this.rule_SKIP(pos);
      const found = this.find(pos);
      return [pos, found === EOF ? EOF : FAIL];
    }
  }

  const baseScannerless = quasifyParser(BaseScannerless);

  function skip(RE) {
    RE = stickyRE(RE);
    // Not an arrow function because its "this" is significant
    return function skipper(pos) {
      const found = this.find(pos);
      if (Array.isArray(found)) {
        const segment = this.template[found[0]];
        RE.lastIndex = found[1];
        const arr = RE.exec(segment);
        if (arr) {
          let value = arr.length === 1 ? arr[0] :
                arr.length === 2 ? arr[1] :
                arr.slice(1);
          return [pos + arr[0].length, value];
        }
      }
      return [pos, FAIL];
    };
  }

  function match(RE) {
    const skipper = skip(RE);
    return function matcher(pos) {
      [pos] = this.rule_SKIP(pos);
      return skipper.call(this, pos);
    };
  }

  // Has the same token-level API as defaultBaseGrammar
  const scannerless = bnf.extends(baseScannerless)`
    start ::= TOKEN* EOF                       ${(toks,_) => toks};
    SKIP ::= (SPACE / COMMENT)*;
    SPACE ::= this.${skip(SPACE_RE)};
    # COMMENT is broken out to make it easy to override
    COMMENT ::= this.${skip(LINE_COMMENT_RE)};

    TOKEN ::= NUMBER / STRING / IDENT / CHAR / HOLE;
    NUMBER ::= this.${match(NUMBER_RE)};
    STRING ::= this.${match(STRING_RE)};
    IDENT ::= this.${match(IDENT_RE)};
`;

  return def({
    BaseScannerless,
    baseScannerless,
    match,
    skip,
    scannerless
  });
}());
