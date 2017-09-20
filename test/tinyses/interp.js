/*global module require*/

module.exports = (function() {
  "use strict";

  const {def} = require('../../src/sesshim.js');

  function interp(ast, env) {
    switch (typeof ast) {
      case 'object': {
        return new Interp(env).i(ast);
      }
      default: {
        throw new Error(`unrecognized: ast ${typeof ast}`);
      }
    }
  }

  function visit(sexpr, visitor) {
    return visitor[sexpr[0]](...sexpr.slice(1));
  }

  class Interp {
    constructor(env) {
      this.env = env;
    }
    i(ast) {
      switch (typeof ast) {
        case 'object': { return visit(ast, this); }
        default: { throw new Error(`unrecognized: ast ${typeof ast}`); }
      }
    }
    all(args) {
      const result = [];
      args.map(arg => {
        if (typeof arg === 'object' && arg[0] === 'spread') {
          result.push(...this.i(arg[1]));
        } else {
          result.push(this.i(arg));
        }
      });
      return result;
    }
    nest(decls) {
      
    }
    script(stats) {
      const nest = this.nest(stats);
      let result = void 0;
      stats.forEach(stat => (result = nest.i(stat)));
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
