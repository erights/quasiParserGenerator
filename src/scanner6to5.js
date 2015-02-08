"use strict";

var _toArray = function (arr) { return Array.isArray(arr) ? arr : Array.from(arr); };

var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

// Options: --free-variable-checker --require --validate
module.exports = (function () {
  "use strict";

  // Should test if in SES, and use SES's def if so.
  var def = Object.freeze;

  var FAIL = def({ toString: function () {
      return "FAIL";
    } });
  var EOF = def({ toString: function () {
      return "EOF";
    } });

  // JSON compat group. See json.org
  var SPACE_RE = /\s+/;
  var NUMBER_RE = /\d+(?:\.\d+)?(?:[eE]-?\d+)?/;
  // Note no \' (escaped single quote) in accord with JSON.
  var CHAR_RE = /[^\"\\]|\\"|\\\\|\\\/|\\b|\\f|\\n|\\r|\\t|\\u[\da-fA-F]{4}/;
  var STRING_RE_SRC = "\\\"(?:" + CHAR_RE.source + ")*\\\"";
  var STRING_RE = RegExp(STRING_RE_SRC);
  var IDENT_RE = /[a-zA-Z_\$][\w\$]*/;

  // Like RE but must match entire string
  function allRE(RE) {
    return RegExp("^" + RE.source + "$", RE.flags);
  }

  // Matches if it matches any of the argument RegExps
  function anyRE() {
    for (var _len = arguments.length, REs = Array(_len), _key = 0; _key < _len; _key++) {
      REs[_key] = arguments[_key];
    }

    return RegExp(REs.map(function (RE) {
      return RE.source;
    }).join("|"));
  }

  // Turn RE into a capture group
  function captureRE(RE) {
    return RegExp("(" + RE.source + ")", RE.flags);
  }

  // A position of a token in a template of a template string.
  // Ideally, somewhere else there's a sourcemap from the source positions
  // of the template string expression itself to the template itself, though
  // this does not exist yet.
  var Pos = (function () {
    function Pos(segmentNum, start, after) {
      _classCallCheck(this, Pos);

      this.segmentNum = segmentNum;
      this.start = start;
      this.after = after;
      def(this);
    }

    _prototypeProperties(Pos, null, {
      toString: {
        value: function toString() {
          return "#" + this.segmentNum + "@" + this.start + ":" + this.after;
        },
        writable: true,
        configurable: true
      }
    });

    return Pos;
  })();

  var Token = (function () {
    function Token(text, pos) {
      _classCallCheck(this, Token);

      this.text = text;
      this.pos = pos;
      def(this);
    }

    _prototypeProperties(Token, {
      tokensInSegment: {
        value: function tokensInSegment(segmentNum, segment, RE, skipRE) {
          var expectedIndex = 0;
          RE.lastIndex = 0;
          var result = [];

          while (RE.lastIndex < segment.length) {
            var arr = RE.exec(segment);
            if (arr === null) {
              var badTok = new Token(segment.slice(RE.lastIndex), new Pos(segmentNum, RE.lastIndex, segment.length));
              throw new SyntaxError("Unexpected: " + badTok);
            }
            var text = arr[1];
            var actualStart = RE.lastIndex - text.length;
            var tok = new Token(text, new Pos(segmentNum, actualStart, RE.lastIndex));
            if (expectedIndex !== actualStart) {
              throw new Error("Internal: " + tok + " expected at " + expectedIndex);
            }
            if (!allRE(skipRE).test(text)) {
              result.push(tok);
            }
            expectedIndex = RE.lastIndex;
          }
          return def(result);
        },
        writable: true,
        configurable: true
      },
      tokensInTemplate: {

        // Interleaved token records extracted from the segments of the
        // template, and bare hole numbers representing the gap between
        // templates.
        value: function tokensInTemplate(template, RE, skipRE) {
          var numSubs = template.length - 1;
          var result = [];
          for (var i = 0; i < numSubs; i++) {
            result.push.apply(result, _toArray(this.tokensInSegment(i, template[i], RE, skipRE)));
            result.push(i); // bare hole number
          }
          result.push.apply(result, _toArray(this.tokensInSegment(numSubs, template[numSubs], RE, skipRE)));
          return result;
        },
        writable: true,
        configurable: true
      }
    }, {
      toString: {
        value: function toString() {
          return "" + JSON.stringify(this.text) + " at " + this.pos;
        },
        writable: true,
        configurable: true
      }
    });

    return Token;
  })();

  // Cheap universal-enough token productions for ad hoc DSLs
  var SINGLE_OP = /[\[\]\(\){},;]/;
  var MULTI_OP = /[:~@%&+=*<>.?|\\\-\^\/]+/;
  var LINE_COMMENT_RE = /#.*\n/;

  // Breaks a string into tokens for cheap ad hoc DSLs
  var TOKEN_RE = captureRE(anyRE(SPACE_RE, NUMBER_RE, STRING_RE, IDENT_RE, SINGLE_OP, MULTI_OP, LINE_COMMENT_RE));

  // Whitespace tokens to skip in cheap ad hoc DSLs
  var WHITESPACE_RE = anyRE(SPACE_RE, LINE_COMMENT_RE);

  var Scanner = (function () {
    function Scanner(template, tokenTypeList) {
      var _this = this;
      _classCallCheck(this, Scanner);

      this.keywords = new Set();
      this.otherTokenTypes = new Set();
      tokenTypeList.map(JSON.parse).forEach(function (tt) {
        if (allRE(IDENT_RE).test(tt)) {
          _this.keywords.add(tt);
        } else {
          _this.otherTokenTypes.add(tt);
        }
      });
      def(this.keywords); // TODO: should also freeze set contents
      def(this.otherTokenTypes); // TODO: should also freeze set contents

      // TODO: derive TOKEN_RE from otherTokenTypes
      // TODO: derive WHITESPACE_RE from further parameters to be
      // provided by the caller.
      this.toks = Token.tokensInTemplate(template, new RegExp(TOKEN_RE.source, "g"), // Note: Not frozen
      WHITESPACE_RE);
      var pos = 0;
      Object.defineProperty(this, "pos", {
        get: function () {
          return pos;
        },
        set: function (oldPos) {
          pos = oldPos;
        },
        enumerable: true,
        configurable: false
      });
      def(this);
    }

    _prototypeProperties(Scanner, null, {
      "try": {
        value: function _try(thunk) {
          var oldPos = this.pos;
          var result = thunk();
          if (FAIL === result) {
            this.pos = oldPos;
          }
          return result;
        },
        writable: true,
        configurable: true
      },
      eat: {
        value: function eat(patt) {
          if (this.pos >= this.toks.length) {
            return FAIL;
          }
          var result = this.toks[this.pos];
          if (typeof result === "number") {
            return FAIL;
          }
          if (typeof patt === "string" && patt === result.text || allRE(patt).test(result.text)) {
            this.pos++;
            return result;
          }
          return FAIL;
        },
        writable: true,
        configurable: true
      },
      eatNUMBER: {
        value: function eatNUMBER() {
          return this.eat(NUMBER_RE);
        },
        writable: true,
        configurable: true
      },
      eatSTRING: {
        value: function eatSTRING() {
          return this.eat(STRING_RE);
        },
        writable: true,
        configurable: true
      },
      eatIDENT: {
        value: function eatIDENT() {
          if (this.pos >= this.toks.length) {
            return FAIL;
          }
          var result = this.toks[this.pos];
          if (typeof result === "number") {
            return FAIL;
          }
          if (allRE(IDENT_RE).test(result.text) && !this.keywords.has(result.text)) {
            this.pos++;
            return result;
          }
          return FAIL;
        },
        writable: true,
        configurable: true
      },
      eatHOLE: {
        value: function eatHOLE() {
          if (this.pos >= this.toks.length) {
            return FAIL;
          }
          var result = this.toks[this.pos];
          if (typeof result === "number") {
            this.pos++;
            return result;
          }
          return FAIL;
        },
        writable: true,
        configurable: true
      },
      eatEOF: {
        value: function eatEOF() {
          return this.pos >= this.toks.length ? EOF : FAIL;
        },
        writable: true,
        configurable: true
      }
    });

    return Scanner;
  })();




  return def({
    FAIL: FAIL, EOF: EOF,
    SPACE_RE: SPACE_RE, NUMBER_RE: NUMBER_RE, STRING_RE: STRING_RE, IDENT_RE: IDENT_RE,
    allRE: allRE, anyRE: anyRE, captureRE: captureRE,
    Token: Token, Scanner: Scanner
  });
})();

/*
var sc = require('./src/scanner6to5');
var scanner = new sc.Scanner(['blah blah','blah'], []);
scanner.toks
*/
