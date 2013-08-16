/// Pass Final: Spidermonkey AST Generation
/// abbr. codegen
/// In this pass, we convert Patrisika AST into SpiderMonkey AST for code 
/// generators, such as Escodegen or Uglify. The SpiderMonkey AST SUCKS. That's
/// one of the the reasons I wrote Patrisika.

var nodeTransformFunctions = {}
var nodeIsStatemental = require('../common/node-types.js').nodeIsStatemental;
var encodeCommonNames = require('../common/tempname').encodeCommonNames
var encodeTNames = require('../common/tempname').encodeTNames

exports.Pass = function(config) {
	var transform = function(node){
		if(!node) throw 'ERROR!'
		if(typeof node === 'string') {
			return {type: 'Identifier', name: encodeCommonNames(node)};
		}
		if((typeof node[0] === 'string') && (typeof nodeTransformFunctions[node[0]] === 'function')) {
			return nodeTransformFunctions[node[0]].apply(null, node.slice(1));
		} else {
			return {
				type: 'CallExpression',
				callee: transform(node[0]),
				arguments: node.slice(1).map(transform)
			}
		}
	}
	var aStatement = function(node){
		var result = transform(node);
		if(nodeIsStatemental(node)) {
			return result
		} else {
			return {
				type: 'ExpressionStatement',
				expression: result
			}
		}
	}
	var ArgsToArray = function(a){return [].slice.call(a, 0)}

	nodeTransformFunctions['.lit'] = function(val){
		return {type: 'Literal', value: val}
	}
	nodeTransformFunctions['.t'] = function(name){
		return {type: 'Identifier', name: encodeTNames(name)}
	}
	nodeTransformFunctions['.unit'] = function(name){
		return {type: 'UnaryExpression', operator:'void', prefix: true, argument: {type: 'Literal', value: 0}}
	}
	nodeTransformFunctions['.declare'] = function(name){
		return transform(['.unit'])
	}
	nodeTransformFunctions['.declare-const'] = function(name){
		return transform(['.unit'])
	}
	nodeTransformFunctions['.args'] = function(name){
		return {type: 'CallExpression', 
			callee: {
				type: 'MemberExpression',
				object: {
					type: 'MemberExpression',
					object: {
						type: 'ArrayExpression',
						elements: []
					},
					property: {type: 'Identifier', name: 'slice'},
					computed: false
				},
				property: {type: 'Identifier', name: 'call'},
				computed: false
			},
			arguments: [{type: 'Identifier', name: 'arguments'}]
		}
	}
	var group = function(s){return '(' + s + ')'}
	var binopoid = function(spiderMonkeyNodeType){
		return function(operator, jsOperator){
			jsOperator = jsOperator || operator
			nodeTransformFunctions[operator] = function(left, right){
				return {
					type: spiderMonkeyNodeType,
					left: transform(left),
					right: transform(right),
					operator: jsOperator
				}
			}	
		}
	}
	var binop = binopoid('BinaryExpression')
	var assop = binopoid('AssignmentExpression')
	var logop = binopoid('LogicalExpression')
	binop('+')
	binop('-')
	binop('*')
	binop('/')
	binop('%')
	binop('<')
	binop('>')
	binop('<=')
	binop('>=')
	binop('==', '===')
	binop('!=', '!==')
	binop('=~', '==')
	binop('!~', '!=')
	logop('&&')
	logop('||')
	assop('=')
	nodeTransformFunctions['.'] = function(left, right){
		return {
			type: 'MemberExpression',
			object: transform(left),
			property: transform(right),
			computed: true
		}
	}
	nodeTransformFunctions['.obj'] = function(){
		return {
			type: 'ObjectExpression',
			properties: ArgsToArray(arguments).map(function(pair){
				return {
					key: {type: 'Literal', value: pair[0]},
					value: transform(pair[1]),
					kind: 'init'
				}
			})
		}
	}
	nodeTransformFunctions['.list'] = function(){
		return {
			type: 'ArrayExpression',
			elements: ArgsToArray(arguments).map(transform)
		}
	}
	nodeTransformFunctions['.this'] = function(){
		return {
			type: 'ThisExpression'
		}
	}
	nodeTransformFunctions['.seq'] = function(){
		return {
			type: 'BlockStatement',
			body: ArgsToArray(arguments).map(aStatement)
		}
	}
	nodeTransformFunctions['.local'] = function(){
		return {
			type: 'VariableDeclaration',
			declarations: ArgsToArray(arguments).map(function(child){
				return {
					type: 'VariableDeclarator',
					id: transform(child),
					init: null
				}
			}),
			kind: 'var'
		}
	}
	nodeTransformFunctions['.if'] = function(condition, thenPart, elsePart){
		return {
			type: 'IfStatement',
			test: transform(condition),
			consequent: aStatement(thenPart),
			alternate: elsePart ? aStatement(elsePart) : null
		}
	}
	nodeTransformFunctions['.while'] = function(condition, body){
		return {
			type: 'WhileStatement',
			test: transform(condition),
			body: aStatement(body)
		}
	}
	nodeTransformFunctions['.fn'] = function(parameters, body) {
		return {
			type: 'FunctionExpression',
			params: parameters.slice(1).map(transform),
			body: aStatement(body),
			expression: false,
			generator: false
		}
	}
	nodeTransformFunctions['.return'] = function(expr) {
		return {
			type: 'ReturnStatement',
			argument: transform(expr)
		}
	}
	nodeTransformFunctions['.label'] = function(label, expr) {
		return {
			type: 'LabeledStatement',
			label: transform(label),
			body: transform(expr)
		}
	}
	nodeTransformFunctions['.break'] = function(label) {
		return {
			type: 'BreakStatement',
			label: transform(label)
		}
	}
	nodeTransformFunctions['.try'] = function(block, param, handler) {
		return {
			type: 'TryStatement',
			block: transform(block),
			handlers: [{
				type: 'CatchClause',
				param: transform(param),
				body: transform(handler)
			}]
		}
	}

	return transform
}