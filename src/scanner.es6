// Options: --free-variable-checker --require --validate
module.exports = (function(){
  "use strict";

  const {def} = require('./sesshim.es6');
  const tsm = require('./templateSourceMap.es6');

  const FAIL = def({toString: () => 'FAIL'});
  const EOF = def({toString: () => 'EOF'});

  // JSON compat group. See json.org
  const SPACE_RE = /\s+/;
  const NUMBER_RE = /-?\d+(?:\.\d+)?(?:[eE]-?\d+)?/;
  // Note no \' (escaped single quote) in accord with JSON.
  const CHAR_RE = /[^\"\\]|\\"|\\\\|\\\/|\\b|\\f|\\n|\\r|\\t|\\u[\da-fA-F]{4}/
  const STRING_RE_SRC = '\\"(?:' + CHAR_RE.source +  ')*\\"';
  const STRING_RE = RegExp(STRING_RE_SRC);
  const IDENT_RE = /[a-zA-Z_\$][\w\$]*/;

  // Like RE but must match entire string
  function allRE(RE) {
    return RegExp('^' + RE.source + '$', RE.flags);
  }

  // Matches if it matches any of the argument RegExps
  function anyRE(...REs) {
    return RegExp(REs.map(RE => RE.source).join('|'));
  }

  // Turn RE into a capture group
  function captureRE(RE) {
    return RegExp('(' + RE.source + ')', RE.flags);
  }

  // Like RE but as if the sticky ('y') flag is on.
  // RE itself should have neither the 'y' nor 'g' flag set,
  // and it should not being with a "^" (start anchor).
  function stickyRE(RE) {
    return RegExp(RE.source, RE.flags + 'y');
  }

  try {
    stickyRE(/x/);
  } catch (er) {
    if (!(er instanceof SyntaxError)) { throw er; }
    // Assume that this platform doesn't support the 'y' flag so we
    // must emulate it
    const superExec = RegExp.prototype.exec;
    stickyRE = function stickyREShim(RE) {
      var result = RegExp(RE.source, RE.flags + 'g');
      result.exec = function stickyExec(str) {
        const start = this.lastIndex;
        const arr = superExec.call(this, str);
        if (!arr) { return arr; }
        if (arr.index !== start) {
          this.lastIndex = 0;
          return null;
        }
        return arr;
      };
      return result;
    };
  }


  // A position of a token in a template of a template string.
  // Ideally, somewhere else there's a sourcemap from the source positions
  // of the template string expression itself to the template itself, though
  // this does not exist yet.
  class Pos {
    constructor(segmentNum, start, after) {
      this.segmentNum = segmentNum;
      this.start = start;
      this.after = after;
      def(this);
    }
    toString() { return `#${this.segmentNum}@${this.start}:${this.after}`; }
  }

  class Token {
    constructor(text, pos) {
      this.text = text;
      this.pos = pos;
      def(this);
    }
    toString() { return `${JSON.stringify(this.text)} at ${this.pos}`; }

    static tokensInSegment(segmentNum, segment, RE) {
      RE = stickyRE(RE);
      let expectedIndex = 0;
      RE.lastIndex = 0;
      const result = [];

      while (RE.lastIndex < segment.length) {
        const arr = RE.exec(segment);
        if (arr === null) {
          const badTok =
              new Token(segment.slice(RE.lastIndex),
                        new Pos(segmentNum, RE.lastIndex, segment.length));
          throw new SyntaxError(`Unexpected: ${badTok}`);
        }
        const text = arr[1];
        const actualStart = RE.lastIndex - text.length;
        const tok = new Token(text,
                              new Pos(segmentNum, actualStart, RE.lastIndex));
        if (expectedIndex !== actualStart) {
          throw new Error(`Internal: ${tok} expected at ${expectedIndex}`);
        }
        result.push(tok);
        expectedIndex = RE.lastIndex;
      }
      return def(result);
    }

    // Interleaved token records extracted from the segments of the
    // template, and bare hole numbers representing the gap between
    // templates.
    static tokensInTemplate(template, RE) {
      const numSubs = template.length - 1;
      const result = [];
      for (let segnum = 0; segnum <= numSubs; segnum++) {
        result.push(...this.tokensInSegment(segnum, template[segnum], RE));
        if (segnum < numSubs) {
          result.push(segnum); // bare hole number
        }
      }
      return result;
    }
  }

  // Cheap universal-enough token productions for ad hoc DSLs
  const SINGLE_OP = /[\[\]\(\){},;]/;
  const MULTI_OP = /[:~@%&+=*<>.?|\\\-\^\/]+/;
  const LINE_COMMENT_RE = /#.*\n/;

  // Breaks a string into tokens for cheap ad hoc DSLs
  const TOKEN_RE = captureRE(anyRE(
    SPACE_RE,
    NUMBER_RE,
    STRING_RE,
    IDENT_RE,
    SINGLE_OP,
    MULTI_OP,
    LINE_COMMENT_RE
  ));


  /**
   * To call the packrat-memoized form of a rule N, call
   * this.run(this.rule_N, pos) rather than
   * this.rule_N(pos). Likewise, call this.run(super.rule_N, pos)
   * rather than super.rule_N(pos).
   */
  class Packratter {
    constructor() {
      // _memo and _counts should all be private instance
      // variables.
      this._memo = new Map();
      // This won't work when moving to SES because the "def(this)" in
      // the constructor will freeze _counts as it should. After
      // all, this is mutable state our clients can corrupt.
      this._counts = {hits: 0, misses: 0};
    }
    run(ruleOrPatt, pos) {
      let posm = this._memo.get(pos);
      if (!posm) {
        posm = new Map()
        this._memo.set(pos, posm);
      }
      let result = posm.get(ruleOrPatt);
      if (result) {
        this._counts.hits++;
      } else {
        this._counts.misses++;
        if (typeof ruleOrPatt === 'function') {
          result = ruleOrPatt.call(this, pos);
        } else {
          result = this.eat(pos, ruleOrPatt);
        }
        posm.set(ruleOrPatt, result);
      }
      return result;
    }
    done() {
      if (this.constructor._debug) {
        console.log('\n');
        for (let [pos, posm] of this._memo) {
          var fails = [];
          for (let [ruleOrPatt, [newPos, v]] of posm) {
          const name = typeof ruleOrPatt === 'function' ? 
                           ruleOrPatt.name : JSON.stringify(ruleOrPatt);
            if (v === FAIL) {
              fails.push(name);
            } else {
              console.log(`${name}(${pos}) => [${newPos}, ${v}]`);
            }
          }
          if (fails.length >= 1) {
            console.log(`@${pos} => FAIL [${fails}]`);
          }
        }
        console.log(`hits: ${this._counts.hits
                            }, misses: ${this._counts.misses}`);
      }
    }
  }

  // _debug should be a private static variable
  Packratter._debug = false;


  /**
   * The default base Parser class for parser traits to extend. This
   * provides a simple conventional lexer, where the production rules
   * correspond to conventional token types. Parsers defined using the
   * <tt>bootbnf.bnf</tt> tag that extend this one generally define
   * the second level of a two level grammar. It you wish to inheric
   * from Scanner in order to define a derived lexer, you probably
   * need to use EcmaScript class inheritance directly.
   */
  class Scanner extends Packratter {
    constructor(template, tokenTypeList=[]) {
      super();
      this.template = template;
      this.keywords = new Set();
      this.otherTokenTypes = new Set();
      tokenTypeList.forEach(tt => {
        if (allRE(IDENT_RE).test(tt)) {
          this.keywords.add(tt);
        } else {
          this.otherTokenTypes.add(tt);
        }
      });
      def(this.keywords);  // TODO: should also freeze set contents
      def(this.otherTokenTypes);  // TODO: should also freeze set contents

      // TODO: derive TOKEN_RE from otherTokenTypes
      this.toks = Token.tokensInTemplate(template.raw, TOKEN_RE);
      def(this);
    }
    start() {
      return this.toks.map(token => token.text);
    }

    syntaxError(start, after, msg='failed to parse') {
      console.log(`
-------template--------
${JSON.stringify(this.template, void 0, ' ')}
-------`);
      const firstTok = this.toks[start];
      const lastTok = this.toks[Math.max(start, after - 1)];
      throw new SyntaxError(`from ${firstTok} to ${lastTok}`);
    }

    skip(pos, RE) {
      if (pos < this.toks.length) {
        const token = this.toks[pos];
        if (typeof token !== 'number') {
          if (allRE(RE).test(token.text)) {
            return [pos + 1, ''];
          }
        }
      }
      return [pos, FAIL];
    }
    rule_SPACE(pos) {
      return this.skip(pos, SPACE_RE);
    }
    rule_COMMENT(pos) {
      return this.skip(pos, LINE_COMMENT_RE);
    }

    // Must always succeed
    //   (SPACE / COMMENT)*
    // Callers should not memoize calls to rule_SKIP as it is likely
    // not worth it. rule_SKIP does not memoize its call to rule_SPACE
    // for the same reason. However, it does memoize its call to
    // rule_COMMENT.
    rule_SKIP(pos) {
      while (pos < this.toks.length) {
        const token = this.toks[pos];
        if (typeof token === 'number') { break; }
        let pair = this.rule_SPACE(pos);
        if (pair[1] !== FAIL) {
          pos = pair[0];
        } else {
          pair = this.run(this.rule_COMMENT, pos);
          if (pair[1] !== FAIL) {
            pos = pair[0];
          } else {
            break;
          }
        }
      }
      return [pos, ''];
    }

    eat(pos, patt) {
      [pos] = this.rule_SKIP(pos);
      if (pos < this.toks.length) {
        const token = this.toks[pos];
        if (typeof token !== 'number') {
          if ((typeof patt === 'string' && patt === token.text) ||
              allRE(patt).test(token.text)) {
            return [pos + 1, token.text];
          }
        }
      }
      return [pos, FAIL];
    }
    rule_NUMBER(pos) { return this.eat(pos, NUMBER_RE); }
    rule_STRING(pos) { return this.eat(pos, STRING_RE); }
    rule_IDENT(pos) {
      [pos] = this.rule_SKIP(pos);
      if (pos >= this.toks.length) { return [pos, FAIL]; }
      const token = this.toks[pos];
      if (typeof token === 'number') { return [pos, FAIL]; }
      if (allRE(IDENT_RE).test(token.text) &&
          !this.keywords.has(token.text)) {
        return [pos + 1, token.text];
      }
      return [pos, FAIL];
    }
    rule_HOLE(pos) {
      [pos] = this.rule_SKIP(pos);
      if (pos >= this.toks.length) { return [pos, FAIL]; }
      const token = this.toks[pos];
      if (typeof token === 'number') {
        return [pos + 1, token];
      }
      return [pos, FAIL];
    }
    rule_EOF(pos) {
      [pos] = this.rule_SKIP(pos);
      return [pos, pos >= this.toks.length ? EOF : FAIL];
    }
  }

  return def({
    FAIL, EOF,
    SPACE_RE, NUMBER_RE, STRING_RE, IDENT_RE,
    LINE_COMMENT_RE,
    allRE, anyRE, captureRE, stickyRE,
    Pos, Token, Packratter, Scanner
  });
}());
