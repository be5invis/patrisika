// PATRISIKA: Code Generation
// In this pass we translate regularized Patrisika AST into SpiderMonkey AST.

var syntax_rule = require('../commons/match.js').syntax_rule;
var _ = require('../commons/match.js')._;
var atom = require('../commons/match.js').atom;
var empty = require('../commons/match.js').empty;
var any = require('../commons/match.js').any;
var ref = require('../commons/match.js').ref;

var resolveIdentifier = require('patrisika-scopes').resolveIdentifier
var resolveTemp = require('patrisika-scopes').resolveTemp

var FormInvalidError = require('../commons/formerror.js').FormInvalidError

exports.pass = function(form, globals, lcmap) {
	if(!lcmap) var syntax_rule_withLoc = syntax_rule;
	else var syntax_rule_withLoc = function(){
		var fn = syntax_rule.apply(this, arguments);
		return function(node){
			var res = fn.apply(this, arguments);
			if(node && node.begins >= 0 && node.ends >= 0){
				res.loc = {
					start: { line: lcmap.line[node.begins], column: lcmap.column[node.begins] },
					end: { line: lcmap.line[node.ends], column: lcmap.column[node.ends] }
				}
			};
			return res;
		}
	};

	var holdingTasks = [];
	var resolutionCache = [];
	function tb(form) {
		var s = ts(form);
		if(s.type !== 'BlockStatement') {
			return {
				type: 'BlockStatement',
				body: [s]
			}
		};
		return s;
	}
	var ts = syntax_rule_withLoc(

		[['.begin', ',..statements'], function(form){
			return {
				type: 'BlockStatement',
				body: this.statements.map(ts)
			}
		}],
		[['.if', ',condition', ',consequent', ',alternate'], function(form){
			return {
				type: 'IfStatement',
				test: te(this.condition),
				consequent: ts(this.consequent),
				alternate: ts(this.alternate)
			}
		}],
		[['.if', ',condition', ',consequent'], function(form){
			return {
				type: 'IfStatement',
				test: te(this.condition),
				consequent: ts(this.consequent),
				alternate: null
			}
		}],
		[['.while', ',test', ',body'], function(form){
			var test = te(this.test);
			var body = ts(this.body);
			var update = null;
			if(body.type === 'BlockStatement' && body.body.length > 1 && body.body[body.body.length - 1] && body.body[body.body.length - 1].type === 'ExpressionStatement') {
				update = body.body.pop().expression
			}
			return {
				type: 'ForStatement',
				init: null,
				test: test,
				update: update,
				body: body
			}
		}],
		[['.try', ',block', [',param'], ',handler'], function(form){
			return {
				type: 'TryStatement',
				block: tb(this.block),
				handlers: [{
					type: 'CatchClause',
					param: te(this.param),
					body: tb(this.handler)
				}]
			}
		}],
		[['.return', ',argument'], function(form){
			return {
				type: 'ReturnStatement',
				argument: te(this.argument)
			}
		}],
		[['.throw', ',argument'], function(form){
			return {
				type: 'ThrowStatement',
				argument: te(this.argument)
			}
		}],
		[any, function(form){
			return {
				type: 'ExpressionStatement',
				expression: te(form)
			}
		}]
	);

	function Binopoid(spiderMonkeyNodeType){
		return function(operator, jsOperator){
			return [[operator, ',..items'], function(){
				if(this.items.length > 1){
					return this.items.slice(1).reduce(function(left, right){
						return {
							type: spiderMonkeyNodeType,
							left: left,
							right: te(right),
							operator: jsOperator || operator
						}
					}, te(this.items[0]));
				} else {
					return te(this.items[0])
				}
			}]
		}
	};
	var binop = Binopoid('BinaryExpression');
	var logop = Binopoid('LogicalExpression');

	var uniop = function(operator, jsOperator) {
		return [[operator, ',argument'], function(){
			return {
				type: "UnaryExpression",
				operator: jsOperator || operator,
				prefix: true,
				argument: te(this.argument)
			}
		}]
	}

	var te = syntax_rule_withLoc(
		[['.lambda', ',args', ',body'], function(form){
			var blank = {}, t = this;
			holdingTasks.push(function(){
				blank.type = 'FunctionExpression';
				blank.params = t.args.map(te);
				blank.body = tb(t.body);
				blank.expression = false;
				blank.generator = false;
				return blank
			});
			return blank;
		}],
		[['.lambda.scoped', ',args', ',body', ',scope'], function(form){
			var blank = {}, t = this;
			holdingTasks.push(function(){
				var params = t.args.map(te)
				var body = tb(t.body);
				var s = t.scope;
				var cacheMatch = resolutionCache[s._N];
				if(cacheMatch) {
					var locals = cacheMatch.locals.map(function(id){
						return {
							type: "VariableDeclarator",
							id: {type: "Identifier", name: s.castName(id)},
							init: null
						}
					});
				} else {
					var locals = [];
				}

				locals = locals.concat(s.temps.map(function(id){
					return {
						type: "VariableDeclarator",
						id: {type: "Identifier", name: resolveTemp(id, s, resolutionCache, globals.strict)},
						init: null
					}
				}));
				if(cacheMatch) for(var j = 0; j < cacheMatch.hangingSubscopes.length; j++){
					var hss = cacheMatch.hangingSubscopes[j];
					if(resolutionCache[hss._N]) {
						locals = locals.concat(resolutionCache[hss._N].locals.map(function(id){
							return {
							 	type: "VariableDeclarator",
							 	id: {type: "Identifier", name: hss.castName(id)},
							 	init: null
							}						
						}), hss.temps.map(function(id){
							return {
								type: "VariableDeclarator",
								id: {type: "Identifier", name: resolveTemp(id, hss, resolutionCache, globals.strict)},
								init: null
							}
						}))
					}
				};
				if(locals.length){
					body.body.unshift({
						type: "VariableDeclaration",
						kind: "var",
						declarations: locals
					});
				};
				blank.type = 'FunctionExpression';
				blank.params = params;
				blank.body = body;
				blank.expression = false;
				blank.generator = false;
				return blank
			});
			return blank;

		}],
		[['.lambda.scoped', ',args', ',body', ',scope', ',id'], function(form){
			var e = te(form.slice(0, -1));
			e.id = te(this.id);
			return e;
		}],
		[['.t', ',id'], function(form){ return { type: 'Identifier', name: this.id }}],
		[['.t', ',id', ',scope'], function(form){ return { type: 'Identifier', name: resolveTemp(this.id, this.scope, resolutionCache, globals.strict) }}],
		[['.id', ',id', ',scope'], function(form){ 
			return { type: 'Identifier', name: resolveIdentifier(this.id, this.scope, resolutionCache, globals.strict) }
		}],
		[['.', ',left', ',right'], function(form){
			return {
				type: 'MemberExpression',
				object: te(this.left),
				property: te(this.right),
				computed: true
			}
		}],
		[['.quote', ',val'], function(form){ 
			if(this.val === undefined) return {type: 'UnaryExpression', operator:'void', prefix: true, argument: {type: 'Literal', value: 0}}
			else if(typeof this.val === "number" && this.val < 0) return {type: "UnaryExpression", operator:'-', prefix: true, argument: {type: "Literal", value: -this.val}}
			else return { type: 'Literal', value: this.val }
		}],
		[['.unit'], function(form){ 
			return {type: 'UnaryExpression', operator:'void', prefix: true, argument: {type: 'Literal', value: 0}}
		}],
		[['.thisp'], function(form){
			return {type: 'ThisExpression'}
		}],
		[['.argsp'], function(form){
			return {type: 'Identifier', name: 'arguments'}
		}],
		uniop('.typeof', 'typeof'),
		uniop('!'),
		uniop('+'),
		uniop('-'),
		binop('+'),
		binop('-'),
		binop('*'),
		binop('/'),
		binop('%'),
		binop('<'),
		binop('>'),
		binop('<='),
		binop('>='),
		binop('==', '==='),
		binop('!=', '!=='),
		binop('===', '==='),
		binop('!==', '!=='),
		binop('=~', '=='),
		binop('!~', '!='),
		binop('.is', 'instanceof'),
		logop('&&'),
		logop('||'),
		[['.set', ',left', ',right'], function(form){
			return {
				type: 'AssignmentExpression',
				left: te(this.left),
				right: te(this.right),
				operator: '='
			}
		}],
		[['.hash', ',..pairs'], function(form){
			return {
				type: 'ObjectExpression',
				properties: this.pairs.map(function(pair){
					return {
						key: {type: 'Literal', value: pair[0]},
						value: te(pair[1]),
						kind: 'init'
					}
				})
			}
		}],
		[['.list', ',..args'], function(form){
			return {
				type: "ArrayExpression",
				elements: this.args.map(te)
			}
		}],
		[['.new', ',callee', ',..args'], function(form){
			return {
				type: "NewExpression",
				callee: te(this.callee),
				arguments: this.args.map(te)
			}
		}],
		[[',callee', ',..args'], function(form){
			return {
				type: 'CallExpression',
				callee: te(this.callee),
				arguments: this.args.map(te)
			}
		}],
		[atom, function(form){ return { type: 'Identifier', name: form } }],
		[any, function(form){
			throw new FormInvalidError(form, "Unknown Node Type")
		}]
	);


	var s = te(['.lambda.scoped', [], form, globals]);
	while(holdingTasks.length) {
		holdingTasks.shift()();
	}
	return s.body;
};