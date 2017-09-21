/*global module require Q tinyses */

module.exports = (function() {
  "use strict";

  const {def} = require('../../src/sesshim.js');

  class Panic extends Error {}

  function assert(flag, str) {
    if (!flag) { throw new Panic(str); }
  }

  const uninitialized = def({});

  function visit(ast, visitor) {
    if (Array.isArray(ast)) {
      if (ast.length >= 1 && typeof ast[0] === 'string') {
        const [kind, ...body] = ast;
        if (kind in visitor) {
          return visitor[kind](ast, ...body);
        }
        assert('visitAst' in visitor, `unrecognized ast kind ${kind}`);
        return visitor.visitAst(ast);
      }
      assert('visitAsts' in visitor, `ast list mistaken for ast ${typeof ast}`);
      return visitor.visitAsts(ast);
    }
    assert(ast !== Object(ast), `primitive data expected ${typeof ast}`);
    assert('visitData' in visitor, `unrecognized: ast ${typeof ast}`);
    return visitor.visitData(ast);
  }


  class ReplaceVisitor {
    visitAst([kind, ...body]) {
      return [kind, ...body.map(e => visit(e, this))];
    }
    visitAsts(asts) {
      return asts.map(ast => visit(ast, this));
    }
    visitData(data) {
      return data;
    }
  }

  class DesugarVisitor extends ReplaceVisitor {
    indexLater(_, base, index) {
      base = visit(base, this);
      index = visit(index, this);
      return tinyses`Q(${base}).get(${index})`;
    }
    getLater(_, base, id) {
      base = visit(base, this);
      return tinyses`Q(${base}).get(${['data',id]})`;
    }
    callLater(_, base, args) {
      base = visit(base, this);
      args = args.map(arg => visit(arg, this));
      if (Array.isArray(base) && base.length >= 1) {
        if (base[0] === 'indexLater') {
          return tinyses`Q(${base[1]}).post(${base[2]}, ...${args})`;
        } else if (base[0] === 'getLater') {
          return tinyses`Q(${base[1]}).post(${['data',base[2]]}, ...${args})`;
        }
      }
      return tinyses`Q(${base}).fcall(...${args})`;
    }
    // quasi and tagged quasi
    // putLater, deleteLater
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
    define(_, name) {
      assert(this.env[name] !== uninitialized, `${name} not uninitialized`);
      return specimen => this.env[name] = specimen;
    }
    matchAll(params) {
      const patternVisitor = this;
      return specimen => {
        params.forEach((param, i) => {
          const paramVisitor = def({
            __proto__: patternVisitor,
            rest(_, patt) {
              return _ => visit(patt, patternVisitor)(specimen.slice(i));
            },
            optional(_, patt,expr) {
              const val = i < specimen.length ?
                  specimen[i] : interp(expr, patternVisitor.env);
              return _ => visit(patt, patternVisitor)(val);
            }
          });
          visit(param, paramVisitor)(specimen[i]);
        });
      };
    }
    matchArray(_, params) {
      return this.matchAll(params);
    }
    matchObj(_, propParams) {
      const patternVisitor = this;
      return specimen => {
        propParams.forEach(propParam => {
          const propParamVisitor = def({
            matchProp(_, key, patt) {
              const k = interpKey(key, patternVisitor.env);
              visit(patt, patternVisitor)(specimen[k]);
            },
            optionalProp(_, key, patt, expr) {
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
    nest(ast) {
      const subEnv = Object.create(this.env);
      //xxx
      return new InterpVisitor(subEnv);
    }
    script(ast, stats) {
      const nest = this.nest(ast);
      let result = void 0;
      stats.forEach(stat => (result = nest.i(stat)));
      return result;
    }
    use(_, name) {
      if (!(name in this.env)) {
        throw new ReferenceError(`${name} not found`);
      }
      const result = this.env[name];
      if (result === uninitialized) {
        throw new TypeError(`${name} not initialized`);
      }
      return result;
    }
    data(_, value) {
      return value;
    }
    array(_, args) {
      return this.all(args);
    }
    object(_, props) {
      const result = {};
      props.map(prop => visit(prop, {
        prop(_, key,val) { result[this.i(key)] = this.i(val); }
      }));
      return result;
    }
    quasi(_, ...parts) {
      //xxx
    }
    get(_, base, id) { return this.i(base)[id]; }
    index(_, base, index) { return this.i(base)[this.i(index)]; }
    getLater(_, base, id) { return Q(this.i(base)).get(id); }
    indexLater(_, base, index) {
      return Q(this.i(base)).get(this.i(index));
    }

    call(_, fnExpr, args) {
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
    tag(_, tagExpr, quasiAst) {
      //xxx
    }
    callLater(_, fnExpr, args) {
      return Q(this.i(fnExpr)).fcall(...this.all(args));
    }
    // tagLater

    delete(_, fe) {
      return visit(fe, {
        get(_, base, id) { return delete this.i(base)[id]; },
        index(_, base, index) { return delete this.i(base)[this.i(index)]; },
        getLater(_, base, id) { return Q(this.i(base)).delete(id); },
        indexLater(_, base, index) {
          return Q(this.i(base)).delete(this.i(index));
        }
      });
    }
    void(_, e) { return void this.i(e); }
    typeof(_, e) {
      // weird typeof scope
      return typeof this.i(e);
    }
    '+'(_, e1, e2=void 0) {
      return e2 ? this.i(e1) + this.i(e2) : +this.i(e1);
    }
    '-'(_, e1, e2=void 0) {
      return e2 ? this.i(e1) - this.i(e2) : -this.i(e1);
    }
    '!'(_, e) { return !this.i(e); }

    '*'(_, e1,e2) { return this.i(e1) * this.i(e2); }
    '/'(_, e1,e2) { return this.i(e1) / this.i(e2); }
    '%'(_, e1,e2) { return this.i(e1) % this.i(e2); }
    '<'(_, e1,e2) { return this.i(e1) < this.i(e2); }
    '>'(_, e1,e2) { return this.i(e1) > this.i(e2); }
    '<='(_, e1,e2) { return this.i(e1) <= this.i(e2); }
    '>='(_, e1,e2) { return this.i(e1) >= this.i(e2); }
    '==='(_, e1,e2) { return this.i(e1) === this.i(e2); }
    '!=='(_, e1,e2) { return this.i(e1) !== this.i(e2); }
    '||'(_, e1,e2) { return this.i(e1) || this.i(e2); }
    '&&'(_, e1,e2) { return this.i(e1) && this.i(e2); }

    '='(_, lv, rv) {
      visit(lv, {
        use(_, name) {
          if (!(name in this.env)) {
            throw new ReferenceError(`${name} not found`);
          }
          const old = this.env[name];
          if (this.env[name] === uninitialized) {
            throw new TypeError(`${name} not initialized`);
          }
          return this.env[name] = this.i(rv);
        },
        get(_, base, id) {
          return this.i(base)[id] = this.i(rv);
        },
        index(_, base, index) {
          return this.i(base)[this.i(index)] = this.i(rv);
        },
        getLater(_, base, id) {},
        indexLater(_, base, index) {}
      });
    }

    assign(_, lv, updateFn) {
      visit(lv, {
        use(_, name) {
          if (!(name in this.env)) {
            throw new ReferenceError(`${name} not found`);
          }
          const old = this.env[name];
          if (this.env[name] === uninitialized) {
            throw new TypeError(`${name} not initialized`);
          }
          return this.env[name] = updateFn(old);
        },
        get(_, base, id) {
          const obj = this.i(base);
          return obj[id] = updateFn(obj[id]);
        },
        index(_, base, index) {
          const obj = this.i(base);
          const key = this.i(index);
          return obj[key] = updateFn(obj[key]);
        },
        getLater(_, base, id) {},
        indexLater(_, base, index) {}
      });
    }

    '*='(_, lv,rv) { return this.assign(lv, o => o * this.i(rv)); }
    '/='(_, lv,rv) { return this.assign(lv, o => o / this.i(rv)); }
    '%='(_, lv,rv) { return this.assign(lv, o => o % this.i(rv)); }
    '+='(_, lv,rv) { return this.assign(lv, o => o + this.i(rv)); }
    '-='(_, lv,rv) { return this.assign(lv, o => o - this.i(rv)); }

    // The incoming side of refraction
    arrow(ast, ps,body) {
      const nest = this.nest(ast);
      return (...rest) => {
        new PatternVisitor(nest.env).matchAll(ps)(rest);
        nest.i(body);
      };
    }
    lambda(ast, ps,expr) {
      const nest = this.nest(ast);
      return (...rest) => {
        new PatternVisitor(nest.env).matchAll(ps)(rest);
        return nest.i(expr);
      };
    }
    
    if(_, c,t,e=void 0) {
      if (this.i(c)) {
        return this.i(t);
      } else if (e) {
        return this.i(e);
      } else {
        return void 0;
      }
    }
    for(_, d,c,i,b) {}
    forOf(_, d,e,b) {}
    while(_, c,b) {
      while (this.i(c)) { this.i(b); }
    }
    try(_, b,x) {
      visit(x, {
        catch(catcher, patt, body) {
          try {
            return this.i(b);
          } catch (err) {
            const nest = this.nest(catcher);
            match(patt, nest.env, err);
            return nest.i(body);
          }
        },
        finally(_, body) {
          try {
            return this.i(b);
          } finally {
            return this.i(body);
          }
        }
      });
    }
    switch(_, e,bs) {}
    debugger(_) { debugger; }

    return(_, e=void 0) {}
    break(_, label=void 0) {}
    throw(_, e) { throw this.i(e); }

    const(_, decls) { this.all(decls); }
    let(_, decls) { this.all(decls); }
    bind(patt, expr) {
      match(patt, this.env)(this.i(expr));
    }
    
    block(ast, stats) {
      const nest = this.nest(ast);
      let result = void 0;
      stats.forEach(stat => (result = nest.i(stat)));
      return result;
    }
  }

  return def({interp});
}());
