// PATRISIKA: Code Generation
// In this pass we translate regularized Patrisika AST into SpiderMonkey AST.

var syntax_rule = require('../commons/match.js').syntax_rule;
var _ = require('../commons/match.js')._;
var atom = require('../commons/match.js').atom;
var empty = require('../commons/match.js').empty;
var any = require('../commons/match.js').any;

var util = require('util');


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
	[['.return', ',argument'], function(form){
		return {
			type: 'ReturnStatement',
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
	return function(operator){
		return function(){
			return {
				type: spiderMonkeyNodeType,
				left: te(this.left),
				right: te(this.right),
				operator: operator
			}
		}	
	}
};
var binop = Binopoid('BinaryExpression');
var assop = Binopoid('AssignmentExpression');
var logop = Binopoid('LogicalExpression');

var te = syntax_rule(
	[['.lambda', ',args', ',body'], function(form){
		if(this.body instanceof Array && this.body[0] === '.begin'){
			this.body = this.body
		} else {
			this.body = ['.begin', this.body]
		}
		return {
			type: 'FunctionExpression',
			params: this.args.map(te),
			body: ts(this.body),
			expression: false,
			generator: false
		}
	}],
	[['.lambda', ',args', ',body', ',locals'], function(form){
		if(this.body instanceof Array && this.body[0] === '.begin'){
			this.body = ['.begin', ['.locals'].concat(this.locals)].concat(this.body.slice(1))
		} else {
			this.body = ['.begin', ['.locals'].concat(this.locals), this.body]
		}
		return {
			type: 'FunctionExpression',
			params: this.args.map(te),
			body: ts(this.body),
			expression: false,
			generator: false
		}
	}],
	[['.t', ',id'], function(form){ return { type: 'Identifier', name: this.id }}],
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
	[['+', ',left', ',right'], binop('+')],
	[['-', ',left', ',right'], binop('-')],
	[['*', ',left', ',right'], binop('*')],
	[['/', ',left', ',right'], binop('/')],
	[['<', ',left', ',right'], binop('<')],
	[['>', ',left', ',right'], binop('>')],
	[['%', ',left', ',right'], binop('%')],
	[['<=', ',left', ',right'], binop('<=')],
	[['>=', ',left', ',right'], binop('>=')],
	[['==', ',left', ',right'], binop('===')],
	[['!=', ',left', ',right'], binop('!==')],
	[['=~', ',left', ',right'], binop('==')],
	[['!~', ',left', ',right'], binop('!=')],
	[['===', ',left', ',right'], binop('===')],
	[['!==', ',left', ',right'], binop('!==')],
	[['.is', ',left', ',right'], binop('instanceof')],
	[['&&', ',left', ',right'], logop('&&')],
	[['||', ',left', ',right'], logop('||')],
	[['=', ',left', ',right'], assop('=')],
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
	[[',callee', ',..args'], function(form){
		return {
			type: 'CallExpression',
			callee: te(this.callee),
			arguments: this.args.map(te)
		}
	}],
	[atom, function(form){ return { type: 'Identifier', name: form }}],
	[any, function(form){
		throw new Error('Unknown node type ' + form)
	}]
);

exports.pass = ts;