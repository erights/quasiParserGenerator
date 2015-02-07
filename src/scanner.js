module.exports = (function(){
  "use strict";

  const SPACE_RE = /\s+/;
  const NUMBER_RE = /\d+(?:\.\d+)?(?:[eE]-?\d+)?/;
  const STRING_RE = /\"(?:[^\"]|\\"|\\\\|\\\/|\\b|\\f|\\n|\\r|\\t|\\u[\da-fA-F][\da-fA-F][\da-fA-F][\da-fA-F])*\"/;
  const IDENT_RE = /[a-zA-Z_\$][\w\$]*/;
  const SINGLE_OP = /[\[\]\(\){},;]/;
  const MULTI_OP = /[:~@%&+=*<>.?|\\\-\^\/]+/;
  const LINE_COMMENT_RE = /#.*\n/;
  
  const TOKEN_RE_SRC = '(' + [
    SPACE_RE,
    NUMBER_RE,
    STRING_RE,
    IDENT_RE,
    SINGLE_OP,
    MULTI_OP,
    LINE_COMMENT_RE
  ].map(re => re.source).join('|') + ')';

  return {
    SPACE_RE,
    NUMBER_RE,
    STRING_RE,
    IDENT_RE,
    SINGLE_OP,
    MULTI_OP,
    LINE_COMMENT_RE,
  
    TOKEN_RE_SRC
  };
}());
