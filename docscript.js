'use strict';

const acorn = require("acorn");
const astring = require('astring');
const walk = require("acorn/dist/walk");
const falafel = require('falafel');
var tt = acorn.tokTypes;

acorn.plugins.docscript = function(parser) {
  parser.extend("parseExpressionStatement", function(nextMethod) {
    return function(node, expr) {

      // console.log(this.type);
      // console.log("hi");

      if (expr.type == 'Identifier') {
	// console.log(node);
	if (this.type == tt.braceL) {
	  let func = this.startNode();
	  func.docscript = true;
	  func.body = this.parseBlock();
	  func.params = [];
	  func.generator = false;
	  func.expression = false;
	  let arg = this.startNode();
	  arg.start = this.start - 1;
	  arg.properties = [];
	  node.callee = expr;
	  node.arguments = [
	    this.finishNode(arg, "ObjectExpression"),
	    this.finishNode(func, "FunctionExpression")
	  ];
	  this.semicolon();
	  return this.finishNode(node, "CallExpression");
	}
      } else if (expr.type == "CallExpression") {
	// console.log(expr);
	if (this.type == tt.braceL) {
	  let func = this.startNode();
	  func.docscript = true;
	  func.body = this.parseBlock();
	  func.params = [];
	  func.generator = false;
	  func.expression = false;
	  // console.log(expr.arguments);
	  //if (expr.arguments.length > 1 ||
	  //    expr.arguments[0].type != "ObjectExpression") {
	  //  this.raise(this.start, "First argument isn't an object!!");
	  // this.raise(this.start, "'with' in strict mode")
	  //}
	  expr.arguments.push(this.finishNode(func, "FunctionExpression"));
	  this.semicolon();
	  return this.finishNode(expr, "CallExpression");
	}
      }

      return nextMethod.call(this, node, expr);
    }
  });

  // enables var a = b {} to be parsed
  parser.extend("parseSubscripts", function(nextMethod) {
    return function(base, startPos, startLoc, noCalls) {
      // handles a {};
      if (!noCalls && this.type == tt.braceL) {
	let func = this.startNode();
	func.docscript = true;
	func.body = this.parseBlock();
	func.params = [];
	func.generator = false;
	func.expression = false;
	// let arg = this.startNode();
	// arg.properties = [];
	let node = this.startNodeAt(startPos, startLoc)
	node.callee = base;
	node.arguments = [
	  // this.finishNode(arg, "ObjectExpression"),
	  this.finishNode(func, "FunctionExpression")
	];
	return this.finishNode(node, "CallExpression")
      }

      let expr = nextMethod.call(
	  this, base, startPos, startLoc, noCalls);

      // If we are in a CallExpression which is followed by a {
      // then eat that and move that into the arguments of the call.
      if (expr.type == "CallExpression" && this.type == tt.braceL) {
	// Makes sure that the first argument of the call is an
	// ObjectExpression.
	// if (expr.arguments.length != 1) {
	//  this.raise(this.start, "More than 1 argument");
	// } else if (expr.arguments[0].type != "ObjectExpression") {
	//  this.raise(this.start, "First argument isn't an object!!");
	// }

	let func = this.startNode();
	func.docscript = true;
	func.body = this.parseBlock();
	func.params = [];
	func.generator = false;
	func.expression = false;
	// func.parent = undefined;
	// Adds the function body as an argument
	expr.arguments.push(this.finishNode(func, "FunctionExpression"));
	// And fixes the start and end indexes to include the function
	// block.
	expr.end = func.end;
	// console.log(expr);
        // debugger;
      }

      return expr;
    }
  });
}

// TODO(goto): figure out how to extent to enable a() {};

// let ast = acorn.parse(docscripts[0], {
// let ast = acorn.parse("var a = b(function() {});", {
// let ast = acorn.parse("var a = foo(function() {});", {
// let ast = acorn.parse("var a = b {};", {
// let ast = acorn.parse("b { c {} };", {
// TODO: let ast = acorn.parse(`b { c { d(); } };`, {
// let ast = acorn.parse(`d("hi");`, {
// let ast = acorn.parse(`d {};`, {
//    plugins: {docscript: true}
// });
// console.log(JSON.stringify(ast, undefined, " "));

// console.log(generate(ast));

// return;

function visitor(node) {
  if (node.type === "CallExpression") {
    // console.log(node.source());
    if (node.arguments.length > 0 &&
	node.arguments[node.arguments.length - 1].docscript) {
      // Makes a distinction between DocScript code inside
      // DocScript (e.g. the span in let a = div { span {} }) code and
      // not (e.g. let a = div {}).
      // TODO(goto): we should probably break on scoping boundaries
      // e.g. is this span within a docscript scope?
      // at the moment, since it is crawling all the way up, i bet
      // that it would eventually hit the div docscript there.
      // function() { div { function bar() { return span {} } } }
      var parent = node.parent;
      var inside = false;
      // console.log(node.parent);
      while (parent) {
	if (parent.type == "FunctionDeclaration" &&
	    !parent.docscript) {
	  // If we are inside a function declaration that is not
	  // a DocScript, that crosses the boundaries of
	  // DocScript inside DocScript because the parameters are
	  // different.
	  break;
	}
	if (parent.docscript) {
	  inside = true;
	  break;
	}
	parent = parent.parent;
      }

      let block = node.arguments.pop();
      // console.log(node.arguments);
      // TODO(goto): there is a bug in the generation of the ObjectExpression
      // that makes props be the empty string that needs further investigation.
      let props = "[";
      // console.log(node.arguments[0].source());
      // console.log(`hello world ${node.arguments[0].source()}`);
      for (let arg in node.arguments) {
	props += `${node.arguments[arg].source()}, `;
      }
      props += "]";
      // let props = node.arguments[0].source() || "undefined";
      // console.log(node.arguments[0]);
      // console.log(`hello ${props}`);
      let callee = node.callee.name;

      // console.log(node);

      let first = callee.charAt(0);
      if (!(first == first.toUpperCase() && first != first.toLowerCase())) {
	// this is not a custom-class reference, but a literal.
	callee = `"${callee}"`;
      }

      // console.log(`foo ${node.source()}`);

      if (!inside) {
	node.update(`DocScript.createElement.call(this, ${callee}, ${props}, function(parent) ${block.source()})`);
      } else {
	node.update(`DocScript.createElement.call(this, ${callee}, ${props}, function(parent) ${block.source()}, parent)`);
      }
    }
  } else if (node.type == "ExpressionStatement") {
    // console.log(`hello ${node.source()}`);
    // Wraps non-docscripts ExpressionStatements into
    // a DocScript.createElement to enable composition of
    // function calls, variable references and literals.
    // enables: div { 1 }
    // filters: div { span {}  };
    // This is so far an ExpressionStatement inside a docscript ...
    // console.log(node);
    let inside = node.parent &&
	node.parent.type == "BlockStatement" &&
	node.parent.parent &&
	node.parent.parent.type == "FunctionExpression" &&
        node.parent.parent.docscript;
    // ... but we want to filter out double-wrapping ExpressionStatements
    // of DocScripts that have already been wrapped.
    let wrapping = node.expression &&
	node.expression.type == "CallExpression" &&
	node.expression.arguments &&
	node.expression.arguments.length > 0 &&
	node.expression.arguments[node.expression.arguments.length - 1].docscript;
    if (inside && !wrapping) {
      node.update(
	  `DocScript.createExpression.call(this, parent, (function(parent) { return ${node.source()} }).call(this))`);
    }
  } else if (node.type == "FunctionExpression") {
    return;
    // If this is a function inside an object declaration as an argument
    // of a docscript, fix its binding to its.
    if (node.parent.type == "Property" &&
        node.parent.parent.type == "ObjectExpression" &&
        node.parent.parent.parent.type == "CallExpression") {
      // console.log(`${node.source()}`);
      let call = node.parent.parent.parent;
      if (call.arguments &&
	  call.arguments.length > 0 &&
	  call.arguments[call.arguments.length -1].docscript) {
	// console.log("hi");
	node.update(`(${node.source()}).bind(this)`);
      }
    }
  }
}

class DocScript {
  static compile(code) {
    // NOTE(goto): major hack ahead, parses using acorn, generates
    // text source code again, then uses falafel to parse (again!)
    // from the source code generated from the ast.
    // There is a bug in falafel where it takes the code as input rather
    // than taking it from the resulting ast constructed by the parser
    // to generate the result.
    // This has certainly performance implications (as you are parsing twice)
    // but may have semantic implications too. This ought to be fixed.
    // let ast = acorn.parse(code, {
    //  plugins: {docscript: true}
    // });
    // let generated = astring.generate(ast);
    var result = falafel(code, {
      parser: acorn, plugins: { docscript: true }
    }, visitor);
    return result;
  }

  static api() {
    return `
class Element {
  constructor(name, opt_attributes) {
    this.name = name;
    if (opt_attributes) {
      this.attributes = opt_attributes || {};
    }
  }

  addChild(el) {
    if (!this.children) {
      // evaluates lazily.
      this.children = [];
    }
    this.children.push(el);
  }
}

class DocScript {

  static createExpression(parent, el) {
      if (!(parent instanceof Element)) {
	  return;
      }

      // el can be either an Element, a string or an array of those things.
      let children = el instanceof Array ? el : [el];

      children.forEach(x => {
        if (x == null || x == undefined) {
	  // Throws errors for null and undefined to enable developers to catch
          // MemberExpressions early.
	  throw new Error("Tried to add an invalid element into the tree");
        }

	if (x instanceof Element || typeof x == "string") {
	  // Ignores anything that isn't an Element or a String.
          parent.addChild(x);
        }
      });
  }

  static createElement(type, props, body, opt_parent) {
    let el;

    let attributes = props.length > 0 ? {} : undefined;

    props.forEach(arg => {
      if (typeof arg == "object") {
        for (let prop in arg) {
          if (!(arg[prop] instanceof Function)) {
            attributes[prop] = arg[prop];
          } else {
            attributes[prop] = (arg[prop]).bind(this);
          }
        }
      }
    });

    if (typeof type == "string") {
      el = new Element(type, attributes);
    } else {
      // TODO(goto): this makes things specific to a render()
      // method. Generalize this.
      el = new type().render();
    }

    body.call(this, el);
    if (opt_parent) {
      opt_parent.addChild(el);
    }
    return el;
  }
}
`;
  }

  static eval(code) {
    let result = DocScript.compile(code);
    // console.log(`${docscript} ${result}`);
    return eval(`${DocScript.api()} ${result}`);
  }
}

//console.log(JSON.stringify(acorn.parse(`d() { 1 };`, {
//    plugins: {docscript: true}
//}), undefined, " "));

// return;

// let code = `d({}) {};`;

// let ast = acorn.parse(code, {
//  plugins: {docscript: true}
// });

// var result = falafel(code, {
//  parser: acorn, plugins: { docscript: true }
// }, visitor);

// console.log(result);

module.exports = {
    DocScript: DocScript
};
