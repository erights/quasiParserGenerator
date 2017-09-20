/*global module require*/

module.exports = (function() {
  "use strict";

  const {def} = require('../../src/sesshim.js');

  class Panic extends Error {}

  const uninitialized = def({});

  function visit(ast, visitor) {
    if (!Array.isArray(ast)) {
      throw new Panic(`unrecognized: ast ${typeof ast}`);
    }
    if (ast.length === 0 || Array.isArray(ast[0])) {
      throw new Panic(`ast list mistaken for ast ${typeof ast}`);
    }
    const [kind, ...body] = ast;
    if (!(kind in visitor)) {
      if ('defaultVisit' in visitor) {
        return visitor.defaultVisit(ast);
      }
      throw new Panic(`unrecognized ast kind ${kind}`);
    }
    return visitor[kind](...body);
  }

  function match(ast, env, specimen) {
    visit(ast, new MatchVisitor(env))(specimen);
  }

  class MatchVisitor {
    constructor(env) {
      this.env = env;
    }
    m(ast, specimen) {
      visit(ast, this)(specimen);
    }
    def(name) {
      if (this.env[name] !== uninitialized) {
        throw new Panic(`${name} not uninitialized`);
      }
      return specimen => this.env[name] = specimen;
    }
    matchArray(params) {
      return specimen => {
        params.forEach((param, i) => {
          const paramVisitor = def({
            __proto__: this,
            rest(patt) {
              //xxx
            },
            optional(id,expr) {
              //xxx
            }
          });
          visit(param, paramVisitor)(specimen[i]);
        });
      };
    }
    matchObj(propParams) {
      propParams.forEach((propParam, i) => {
      });
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
        prop(key,val) { result[this.i(key)] = this.i(val); },
        spreadObj(rest) { Object.assign(result, this.i(rest)); }
      }));
      return result;
    }
    quasi(...parts) {
      //xxx
    }
    get(objExpr, id) { return this.i(objExpr)[id]; }
    index(objExpr, indexExpr) { return this.i(objExpr)[this.i(indexExpr)]; }
    call(fnExpr, args) { return this.i(fnExpr)(...this.all(args)); }
    tag(tagExpr, quasiAst) {
      //xxx
    }
    // getLater, indexLater, callLater, tagLater
    void(e) { return void this.i(e); }
    typeof(e) { 
      // weird typeof scope
      return typeof this.i(e); 
    }
    '+'(e) { return +this.i(e); }
    '-'(e) { return -this.i(e); }
    '!'(e) { return !this.i(e); }

    delete(fe) {
      return visit(fe, {
        get(obj, id) { delete this.i(obj)[id]; },
        index(obj, index) { delete this.i(obj)[this.i(index)]; },
        getLater(obj, id) {},
        indexLater(obj, index) {}
      });
    }
    '+'(e1,e2) { return this.i(e1) + this.i(e2); }
    
    '='(lv,rv) { return this.assign(lv, _ => this.i(rv)); }
    '=+'(lv,rv) { return this.assign(lv, o => o + this.i(rv)); }

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
