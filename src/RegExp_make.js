"use strict";

RegExp.make = (function () {
  const BLOCK = 0;
  const BACKSLASH = 1;
  const CHARSET = 2;
  const COUNT = 3;

  // For each context, group 1 matches any token that exits the
  // context.
  const CONTEXT_TOKENS = [
      /^(?:([\\\{\[])|(?:[^\\\{\[]|\\.)+)/,
      /^(?:[\s\S])/,
      /^(?:(\])|(?:[^\]\\]|\\.)+)/,
      /^(?:([\}])|[^\}]+)/,
  ];

  const CONTEXTS_CACHE = new WeakMap();

  function computeContexts(template) {
    const contexts = [];

    const raw = template.raw;

    let i = 0;
    const n = raw.length;
    let context = BLOCK;
    // We step over parts and consume tokens until we reach an
    // interpolation point.

    let currentPart = raw[0];
    while (i < n || currentPart) {
      if (!currentPart) {
        // We've reached an interpolation point.
        ++i;
        currentPart = raw[i];
        contexts.push(context);
        continue;
      }
      let m = CONTEXT_TOKENS[context].exec(currentPart);
      currentPart = currentPart.substring(m[0].length);
      if (!m[0].length) { throw new Error(currentPart); }
      if (m[1]) {
        switch (context) {
        case BLOCK:
          switch (m[1]) {
          case '\\': context = BACKSLASH; break;
          case '[':  context = CHARSET;   break;
          case '{':  context = COUNT;     break;
          default: throw new Error(m[1]);
          }
          break;
        case BACKSLASH:
        case CHARSET:
        case COUNT:
          context = BLOCK;
          break;
        }
      }
    }

    // We don't need the context after the last part
    // since no value is interpolated there.
    contexts.length--;

    CONTEXTS_CACHE[template] = {
      contexts: contexts
    };
  }

  const UNSAFE_CHARS_BLOCK = /[\\(){}\[\]\|\?\*\+\^\$\/]/g;
  const UNSAFE_CHARS_CHARSET = /[\]\-\\]/g;

  function destructureChars(source) {
    const n = source.length;
    if (source.charAt(0) === '['
        && source.charAt(n - 1) === ']') {
      // Guard \ at the end and unescaped ].
      const chars = source.substring(1, n - 1).replace(
          /((?:^|[^\\])(?:\\\\)*)(?:\\$|\])/g, '\\$&');
      return chars;
    }
    return '';
  }

  return function make(template, ...values) {
    if (values.length === 0 && typeof template === 'string') {
      // Allow RegExp.make(i)`...` to specify flags.
      // This calling convention is disjoint with use as a template tag
      // since the typeof a template record is 'object'.
      const flags = template;
      return function (template, ...values) {
        const re = make(template, ...values);
        return new RegExp(re.source, flags);
      };
    }

    let computed = CONTEXTS_CACHE[template];
    if (!computed) {
      computeContexts(template);
      computed = CONTEXTS_CACHE[template];
    }
    const contexts = computed.contexts;
    const raw = template.raw;

    const n = contexts.length;
    let pattern = raw[0];
    for (let i = 0; i < n; ++i) {
      const context = contexts[i];
      const value = values[i];
      let subst;
      switch (context) {
      case BLOCK:
        subst = '(?:'
          + (
            (value instanceof RegExp)
              ? String(value.source)
              : String(value).replace(UNSAFE_CHARS_BLOCK, '\\$&')
          )
          + ')';
        break;
      case BACKSLASH:
      case COUNT:
        subst = (+value || '0');
        break;
      case CHARSET:
        subst =
          (value instanceof RegExp)
          ? destructureChars(String(value.source))
          : String(value).replace(UNSAFE_CHARS_CHARSET, '\\$&');
        break;
      }
      pattern += subst;
      pattern += raw[i+1];
    }
    return new RegExp(pattern, '');
  };

  // TODO: When interpolating regular expressions, turn capturing
  // groups into non-capturing groups.

  // TODO: Rewrite a-z when interpolating charsets that have a
  // different case-sensitivity.

})();
