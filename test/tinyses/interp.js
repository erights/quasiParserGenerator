/*global module require Q */

module.exports = (function() {
  "use strict";

  const {def} = require('../../src/sesshim.js');

  class Panic extends Error {}

  function assert(flag, str) {
    if (!flag) { throw new Panic(str); }
  }

  const uninitialized = def({});

  function visit(ast, visitor) {
    assert(Array.isArray(ast), `unrecognized: ast ${typeof ast}`);
    assert(ast.length >= 1 && typeof ast[0] === 'string',
           `ast list mistaken for ast ${typeof ast}`);
    const [kind, ...body] = ast;
    if (!(kind in visitor)) {
      assert('defaultVisit' in visitor, `unrecognized ast kind ${kind}`);
      return visitor.defaultVisit(ast);
    }
    return visitor[kind](...body);
  }

  function interpKey(ast, env) {
    if (Array.isArray(ast) && ast[0] === 'computed') {
      return interp(ast[1], env);
    }
    assert(ast !== Object(ast), `unexpected key ${typeof ast}`);
    return ast;
  }

  function match(ast, env, specimen) {
    visit(ast, new PatternVisitor(env))(specimen);
  }

  class PatternVisitor {
    constructor(env) {
      this.env = env;
    }
    m(ast, specimen) {
      visit(ast, this)(specimen);
    }
    def(name) {
      assert(this.env[name] !== uninitialized, `${name} not uninitialized`);
      return specimen => this.env[name] = specimen;
    }
    matchArray(params) {
      const patternVisitor = this;
      return specimen => {
        params.forEach((param, i) => {
          const paramVisitor = def({
            __proto__: patternVisitor,
            rest(patt) {
              return _ => visit(patt, patternVisitor)(specimen.slice(i));
            },
            optional(patt,expr) {
              const val = i < specimen.length ?
                  specimen[i] : interp(expr, patternVisitor.env);
              return _ => visit(patt, patternVisitor)(val);
            }
          });
          visit(param, paramVisitor)(specimen[i]);
        });
      };
    }
    matchObj(propParams) {
      const patternVisitor = this;
      return specimen => {
        propParams.forEach(propParam => {
          const propParamVisitor = def({
            matchProp(key, patt) {
              const k = interpKey(key, patternVisitor.env);
              visit(patt, patternVisitor)(specimen[k]);
            },
            optionalProp(key, patt, expr) {
              const k = interpKey(key, patternVisitor.env);
              const val = k in specimen ?
                    specimen[k] : interp(expr, patternVisitor.env);
              visit(patt, patternVisitor)(val);
            }
          });
          visit(propParam, propParamVisitor);
        });
      };
    }
  }

  function interp(ast, env) {
    return new InterpVisitor(env).i(ast);
  }

  class InterpVisitor {
    constructor(env) {
      this.env = env;
    }
    i(ast) {
      return visit(ast, this);
    }
    all(args) {
      const result = [];
      args.forEach(arg => {
        if (typeof arg === 'object' && arg[0] === 'spread') {
          result.push(...this.i(arg[1]));
        } else {
          result.push(this.i(arg));
        }
      });
      return result;
    }
    nest(decls) {
      const subEnv = Object.create(this.env);
      //xxx
      return new InterpVisitor(subEnv);
    }
    script(stats) {
      const nest = this.nest(stats);
      let result = void 0;
      stats.forEach(stat => (result = nest.i(stat)));
      return result;
    }
    use(name) {
      if (!(name in this.env)) {
        throw new ReferenceError(`${name} not found`);
      }
      const result = this.env[name];
      if (result === uninitialized) {
        throw new TypeError(`${name} not initialized`);
      }
      return result;
    }
    data(value) {
      return value;
    }
    array(args) {
      return this.all(args);
    }
    object(props) {
      const result = {};
      props.map(prop => visit(prop, {
        prop(key,val) { result[this.i(key)] = this.i(val); }
      }));
      return result;
    }
    quasi(...parts) {
      //xxx
    }
    get(base, id) { return this.i(base)[id]; }
    index(base, index) { return this.i(base)[this.i(index)]; }
    getLater(base, id) { return Q(this.i(base)).get(id); }
    indexLater(base, index) {
      return Q(this.i(base)).get(this.i(index));
    }

    call(fnExpr, args) {
      if (Array.isArray(fnExpr)) {
        if (fnExpr[0] === 'getLater') {
          return Q(this.i(fnExpr[1])).post(fnExpr[2],
                                           ...this.all(args));
        } else if (fnExpr[0] === 'indexLater') {
          return Q(this.i(fnExpr[1])).post(this.i(fnExpr[2]),
                                           ...this.all(args));
        }
      }
      return this.i(fnExpr)(...this.all(args));
    }
    tag(tagExpr, quasiAst) {
      //xxx
    }
    callLater(fnExpr, args) {
      return Q(this.i(fnExpr)).fcall(...this.all(args));
    }
    // tagLater

    delete(fe) {
      return visit(fe, {
        get(base, id) { return delete this.i(base)[id]; },
        index(base, index) { return delete this.i(base)[this.i(index)]; },
        getLater(base, id) { return Q(this.i(base)).delete(id); },
        indexLater(base, index) {
          return Q(this.i(base)).delete(this.i(index));
        }
      });
    }
    void(e) { return void this.i(e); }
    typeof(e) {
      // weird typeof scope
      return typeof this.i(e);
    }
    '+'(e1, e2=void 0) {
      return e2 ? this.i(e1) + this.i(e2) : +this.i(e1);
    }
    '-'(e1, e2=void 0) {
      return e2 ? this.i(e1) - this.i(e2) : -this.i(e1);
    }
    '!'(e) { return !this.i(e); }

    '*'(e1,e2) { return this.i(e1) * this.i(e2); }
    '/'(e1,e2) { return this.i(e1) / this.i(e2); }
    '%'(e1,e2) { return this.i(e1) % this.i(e2); }
    '<'(e1,e2) { return this.i(e1) < this.i(e2); }
    '>'(e1,e2) { return this.i(e1) > this.i(e2); }
    '<='(e1,e2) { return this.i(e1) <= this.i(e2); }
    '>='(e1,e2) { return this.i(e1) >= this.i(e2); }
    '==='(e1,e2) { return this.i(e1) === this.i(e2); }
    '!=='(e1,e2) { return this.i(e1) !== this.i(e2); }
    '||'(e1,e2) { return this.i(e1) || this.i(e2); }
    '&&'(e1,e2) { return this.i(e1) && this.i(e2); }

    '='(lv, rv) {
      visit(lv, {
        use(name) {
          if (!(name in this.env)) {
            throw new ReferenceError(`${name} not found`);
          }
          const old = this.env[name];
          if (this.env[name] === uninitialized) {
            throw new TypeError(`${name} not initialized`);
          }
          return this.env[name] = this.i(rv);
        },
        get(base, id) {
          return this.i(base)[id] = this.i(rv);
        },
        index(base, index) {
          return this.i(base)[this.i(index)] = this.i(rv);
        },
        getLater(base, id) {},
        indexLater(base, index) {}
      });
    }

    assign(lv, updateFn) {
      visit(lv, {
        use(name) {
          if (!(name in this.env)) {
            throw new ReferenceError(`${name} not found`);
          }
          const old = this.env[name];
          if (this.env[name] === uninitialized) {
            throw new TypeError(`${name} not initialized`);
          }
          return this.env[name] = updateFn(old);
        },
        get(base, id) {
          const obj = this.i(base);
          return obj[id] = updateFn(obj[id]);
        },
        index(base, index) {
          const obj = this.i(base);
          const id = this.i(index);
          return obj[id] = updateFn(obj[id]);
        },
        getLater(base, id) {},
        indexLater(base, index) {}
      });
    }

    '*='(lv,rv) { return this.assign(lv, o => o * this.i(rv)); }
    '/='(lv,rv) { return this.assign(lv, o => o / this.i(rv)); }
    '%='(lv,rv) { return this.assign(lv, o => o % this.i(rv)); }
    '+='(lv,rv) { return this.assign(lv, o => o + this.i(rv)); }
    '-='(lv,rv) { return this.assign(lv, o => o - this.i(rv)); }

    arrow(ps,body) {}
    lambda(ps,expr) {}
    if(c,t,e=void 0) {}
    for(d,c,i,b) {}
    forOf(d,e,b) {}
    while(c,b) {}
    try(b,x,y=void 0) {}
    switch(e,bs) {}
    debugger() { debugger; }

    return(e=void 0) {}
    break(label=void 0) {}
    throw(e) {}

    const(decls) {}
    let(decls) {}
    block(stats) {
      const nest = this.nest(stats);
      let result = void 0;
      stats.forEach(stat => (result = nest.i(stat)));
      return result;
    }
  }

  return def({interp});
}());
