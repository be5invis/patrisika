// PATRISIKA: Code Generation
// In this pass we translate regularized Patrisika AST into SpiderMonkey AST.

var syntax_rule = require('../commons/match.js').syntax_rule;
var _ = require('../commons/match.js')._;
var atom = require('../commons/match.js').atom;
var empty = require('../commons/match.js').empty;
var any = require('../commons/match.js').any;
var ref = require('../commons/match.js').ref;

var resolveIdentifier = require('patrisika-scopes').resolveIdentifier

var util = require('util');

function tb(form){
	var s = ts(form);
	if(s.type !== 'BlockStatement') {
		return {
			type: 'BlockStatement',
			body: [s]
		}
	};
	return s;
}
var ts = syntax_rule(
	[['.locals', ',..ids'], function(form){
		return {
			type: 'VariableDeclaration',
			declarations: this.ids.map(function(child){
				return {
					type: 'VariableDeclarator',
					id: te(child),
					init: null
				}
			}),
			kind: 'var'
		}
	}],
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
		return {
			type: 'WhileStatement',
			test: te(this.test),
			body: ts(this.body)
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

var te = syntax_rule(
	[['.lambda', ',args', ',body'], function(form){
		return {
			type: 'FunctionExpression',
			params: this.args.map(te),
			body: tb(this.body),
			expression: false,
			generator: false
		}
	}],
	[['.lambda.scoped', ',args', ',body', ',scope'], function(form){
		var body = tb(this.body);
		var s = this.scope;
		var locals = s.locals.map(function(id){
			return {
				type: "VariableDeclarator",
				id: {type: "Identifier", name: s.castName(id)},
				init: null
			}
		});
		locals = locals.concat(s.temps.map(function(id){
			return {
				type: "VariableDeclarator",
				id: {type: "Identifier", name: s.castTempName(id)},
				init: null
			}			
		}));
		if(locals.length){
			body.body.unshift({
				type: "VariableDeclaration",
				kind: "var",
				declarations: locals
			});
		}
		return {
			type: 'FunctionExpression',
			params: this.args.map(te),
			body: body,
			expression: false,
			generator: false
		}
	}],
	[['.t', ',id'], function(form){ return { type: 'Identifier', name: this.id }}],
	[['.t', ',id', ',scope'], function(form){ return { type: 'Identifier', name: this.scope.castTempName(this.id) }}],
	[['.id', ',id', ',scope'], function(form){ return { type: 'Identifier', name: resolveIdentifier(this.id, this.scope) }}],
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
		return { type: 'Literal', value: this.val }
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
	[['!', ',argument'], function(form) {
		return {
			type: "UnaryExpression",
			operator: "!",
			prefix: true,
			argument: te(this.argument)
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
		throw new Error('Unknown node type ' + form)
	}]
);

exports.pass = function(form, globals){
	var s = te(['.lambda.scoped', [], form, globals]).body;

	return s;
};