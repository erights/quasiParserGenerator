/*global module require Q */

module.exports = (function() {
  "use strict";

  const {def} = require('../../src/sesshim.js');
  const {visit, assert} = require('../../src/interp-utils.js');
  const {InterpJSONVisitor} = require('./interp-json.js');

  function interpJester(ast, env) {
    return new InterpJesterVisitor(env).i(ast);
  }

  class InterpJesterVisitor extends InterpJSONVisitor {
    constructor(env) {
      super();
      this.env = env;
    }
    all(args) {
      const result = [];
      // An arrow function to capture lexical this
      args.forEach(arg => {
        if (Array.isArray(arg) && arg[0] === 'spread') {
          result.push(...this.i(arg[1]));
        } else {
          result.push(this.i(arg));
        }
      });
      return result;
    }
    array(_, args) { return this.all(args); }
    record(_, props) {
      const result = {};
      props.forEach(prop => visit(prop, {
        // Arrow functions to capture lexical this
        prop: (_, key,val) => { result[this.i(key)] = this.i(val); },
        spreadObj: (_, rest) => {
          Object.assign(result, this.i(rest));
        }
      }));
      return result;
    }
    use(_, id) {
      assert(id in this.env, `unrecognized var ${id}`);
      return this.env[id];
    }
    index(_, base, index) { return this.i(base)[this.i(index)]; }
    data(_, value) { return value; }
    get(_, base, name) { return this.i(base)[name]; }

/*
    quasi(parts) {
      // TODO bug: This is the one element of Jester where we do need
      // static preprocessing to be correct. We need to pre-extract
      // the literal parts into a literal object that has the same
      // identity on each sub-evaluation.
      // TODO bug: We only provide the raw form at this time. I
      // apologize once again for allowing a cooked form into the
      // standard.
      const raw = [parts[0]];
      const args = [];
      const len = parts.length;
      for (let i = 1; i < len; i += 2) {
        args.push(parts[i]);
        raw.push(parts[i+1]);
      }
    }
    tag(tagExpr, quasiExpr) {
      
    }
*/

    // unary
    void(_, x) { return void this.i(x); }
    typeof(_, x) { return typeof this.i(x); }
    'pre:+'(_, x) { return +this.i(x); }
    'pre:-'(_, x) { return -this.i(x); }
    'pre:~'(_, x) { return ~this.i(x); }
    'pre:!'(_, x) { return !this.i(x); }

    // binary
    '**'(_, x, y) { return this.i(x) ** this.i(y); }
    '*'(_, x, y) { return this.i(x) * this.i(y); }
    '/'(_, x, y) { return this.i(x) / this.i(y); }
    '%'(_, x, y) { return this.i(x) % this.i(y); }
    '+'(_, x, y) { return this.i(x) + this.i(y); }
    '-'(_, x, y) { return this.i(x) - this.i(y); }
    '<<'(_, x, y) { return this.i(x) << this.i(y); }
    '>>'(_, x, y) { return this.i(x) >> this.i(y); }
    '>>>'(_, x, y) { return this.i(x) >>> this.i(y); }
    '<'(_, x, y) { return this.i(x) < this.i(y); }
    '<='(_, x, y) { return this.i(x) <= this.i(y); }
    '==='(_, x, y) { return this.i(x) === this.i(y); }
    '!=='(_, x, y) { return this.i(x) !== this.i(y); }
    '>='(_, x, y) { return this.i(x) >= this.i(y); }
    '>'(_, x, y) { return this.i(x) > this.i(y); }
    '&'(_, x, y) { return this.i(x) & this.i(y); }
    '^'(_, x, y) { return this.i(x) ^ this.i(y); }
    '|'(_, x, y) { return this.i(x) | this.i(y); }
    '&&'(_, x, y) { return this.i(x) && this.i(y); }
    '||'(_, x, y) { return this.i(x) || this.i(y); }
    
    ','(_, x, y) { return (this.i(x), this.i(y)); }

    // ?:
    cond(_, x, y, z) {
      return this.i(x) ? this.i(y) : this.i(z);
    }
  }

  return def({interpJester});
}());
