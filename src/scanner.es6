// Options: --free-variable-checker --require --validate
module.exports = (function(){
  "use strict";

  // TODO: Should test if in SES, and use SES's def if so.
  const def = Object.freeze;

  const FAIL = def({toString: () => 'FAIL'});
  const EOF = def({toString: () => 'EOF'});

  // JSON compat group. See json.org
  const SPACE_RE = /\s+/;
  const NUMBER_RE = /\d+(?:\.\d+)?(?:[eE]-?\d+)?/;
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

    static tokensInSegment(segmentNum, segment, RE, skipRE) {
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
        if (!allRE(skipRE).test(text)) { result.push(tok); }
        expectedIndex = RE.lastIndex;
      }
      return def(result);
    }

    // Interleaved token records extracted from the segments of the
    // template, and bare hole numbers representing the gap between
    // templates.
    static tokensInTemplate(template, RE, skipRE) {
      const numSubs = template.length - 1;
      var result = [];
      for (var i = 0; i < numSubs; i++) {
        result.push(...this.tokensInSegment(i, template[i], RE, skipRE));
        result.push(i); // bare hole number
      }
      result.push(...this.tokensInSegment(
          numSubs, template[numSubs], RE, skipRE));
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

  // Whitespace tokens to skip in cheap ad hoc DSLs
  const WHITESPACE_RE = anyRE(SPACE_RE, LINE_COMMENT_RE);

  class Scanner {
    constructor(template, tokenTypeList) {
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
      // TODO: derive WHITESPACE_RE from further parameters to be
      // provided by the caller.
      this.toks = Token.tokensInTemplate(
          template,
          new RegExp(TOKEN_RE.source, 'g'),  // Note: Not frozen
          WHITESPACE_RE);
      def(this);
    }

    eat(pos, patt) {
      if (pos >= this.toks.length) { return [pos, FAIL]; }
      var token = this.toks[pos];
      if (typeof token === 'number') { return [pos, FAIL]; }
      if ((typeof patt === 'string' && patt === token.text) ||
          allRE(patt).test(token.text)) {
        return [pos + 1, token.text];
      }
      return [pos, FAIL];
    }
    eatNUMBER(pos) { return this.eat(pos, NUMBER_RE); }
    eatSTRING(pos) { return this.eat(pos, STRING_RE); }
    eatIDENT(pos) {
      if (pos >= this.toks.length) { return [pos, FAIL]; }
      var token = this.toks[pos];
      if (typeof token === 'number') { return [pos, FAIL]; }
      if (allRE(IDENT_RE).test(token.text) &&
          !this.keywords.has(token.text)) {
        return [pos + 1, token.text];
      }
      return [pos, FAIL];
    }
    eatHOLE(pos) {
      if (pos >= this.toks.length) { return [pos, FAIL]; }
      var token = this.toks[pos];
      if (typeof token === 'number') {
        return [pos + 1, token];
      }
      return [pos, FAIL];
    }
    eatEOF(pos) {
      return [pos, pos >= this.toks.length ? EOF : FAIL];
    }
  }


  return def({
    FAIL, EOF,
    SPACE_RE, NUMBER_RE, STRING_RE, IDENT_RE,
    allRE, anyRE, captureRE,
    Token, Scanner
  });
}());
