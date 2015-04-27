// Options: --free-variable-checker --require --validate
module.exports = (function(){
  "use strict";

  const {def} = require('./sesshim.es6');
  const {FAIL, EOF,
    SPACE_RE, NUMBER_RE, STRING_RE, IDENT_RE,
    LINE_COMMENT_RE, stickyRE, Pos} = require('./scanner.es6');
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
  class BaseScannerless {
    constructor(template) {
      this.template = template;
    }
    start() {
      const result = [];
      const numSubs = template.length - 1;
      for (let segnum = 0; segnum <= numSubs; segnum++) {
        result.push(...template[segnum]);
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
        } else if (relpos == seglen && segnum < numSubs) {
          return segnum;  // as hole number
        }
        relpos -= seglen + 1; // "+1" for the skipped hole
      }
      return EOF;
    }
    syntaxError(start, after, msg='failed to parse') {
      console.log(`
-------template--------
${JSON.stringify(this.template, void 0, ' ')}
-------`);
      const st = this.find(start);
      const af = this.find(after);
      throw new SyntaxError(`from ${st} upto ${af}`);
    }
    eat(pos, patt) {
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
      const found = this.find(pos);
      if (Array.isArray(found)) {
        return [pos + 1, this.template[found[0]][found[1]]];
      }
      return [pos, FAIL];
    }
    rule_HOLE(pos) {
      const found = this.find(pos);
      if (typeof found === 'number') { return [pos + 1, found]; }
      return [pos, FAIL];
    }
    rule_EOF(pos) {
      const found = this.find(pos);
      return [pos, found === EOF ? EOF : FAIL];
    }
  }

  const baseScannerless = quasifyParser(BaseScannerless);

  function match(RE) {
    RE = stickyRE(RE);
    // Not an arrow function because its "this" is significant
    return function(pos) {
      const found = this.find(pos);
      if (Array.isArray(found)) {
        const segment = this.template[found[0]];
        RE.lastIndex = found[1];
        const arr = RE.exec(segment);
        if (arr) {
          let value = arr.length === 0 ? arr[0] :
                arr.length === 1 ? arr[1] :
                arr.slice(1);
          return [pos + arr.index + arr[0].length, value];
        }
      }
      return [pos, FAIL];
    };
  }

  const scannerless = bnf.extends(baseScannerless)`
    start ::= TOKEN* EOF                       ${(toks,_) => toks};
    TOKEN ::= NUMBER | STRING | IDENT | CHAR | HOLE;
    SPACE ::= this.${match(SPACE_RE)};
    # COMMENT is broken out to make it easy to override
    COMMENT ::= this.${match(LINE_COMMENT_RE)};
    WHITE ::= (SPACE | COMMENT)*;
    NUMBER ::= WHITE this.${match(NUMBER_RE)}  ${(_,v) => v};
    STRING ::= WHITE this.${match(STRING_RE)}  ${(_,v) => v};
    IDENT ::= WHITE this.${match(IDENT_RE)}    ${(_,v) => v};
    CHAR ::= WHITE super.CHAR                  ${(_,v) => v};
    EOF ::= WHITE super.EOF                    ${(_,v) => v};
`;

  return def({
    BaseScannerless,
    baseScannerless,
    match,
    scannerless
  });
}());
