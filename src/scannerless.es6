// Options: --free-variable-checker --require --validate
module.exports = (function(){
  "use strict";

  const {def} = require('./sesshim.es6');
  const {FAIL, EOF, Pos} = require('./scanner.es6');
  const {quasifyParser} = require('./bootbnf.es6');


  /**
   * The base Parser class for parser traits to extend in order to
   * define Scannerless parsers. This class functions as a degenerate
   * Lexer whose "tokens", so to speak, are either<ul>
   * <li>a character,
   * <li>a hole number,
   * <li>EOF
   * </ul>
   */
  class Scannerless {
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
      const numSubs = template.length - 1;
      let relpos = pos;
      for (let segnum = 0; segnum <= numSubs; segnum++) {
        const segment = template[segnum];
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
        const specimen = template[found[0]].slice(found[1]);
        if (typeof pass === 'string') {
          if (specimen.startsWith(patt)) {
            return [pos + patt.length, patt];
          }
        }
      }
      return [pos, FAIL];
    }
    rule_CHAR(pos) {
      const found = this.find(pos);
      if (Array.isArray(found)) {
        return [pos + 1, template[found[0]][found[1]]];
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

  const scannerless = quasifyParser(Scannerless);

  return def({
    Scannerless
  });
}());
