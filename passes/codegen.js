/// Pass Final: Spidermonkey AST Generation
/// abbr. codegen
/// In this pass, we convert Patrisika AST into SpiderMonkey AST for code 
/// generators, such as Escodegen or Uglify. The SpiderMonkey AST SUCKS. That's
/// one of the the reasons I wrote Patrisika.

var nodeTranformFunctions = {}
var nodeIsStatemental = require('../common/node-types.js').nodeIsStatemental;
var encodeCommonNames = require('../common/tempname').encodeCommonNames
var encodeTNames = require('../common/tempname').encodeTNames

exports.Pass = function(config) {
	var transform = function(node){
		if(!node) throw 'ERROR!'
		if(typeof node === 'string') {
			return {type: 'Identifier', name: encodeCommonNames(node)};
		}
		if((typeof node[0] === 'string') && (typeof nodeTranformFunctions[node[0]] === 'function')) {
			return nodeTranformFunctions[node[0]].apply(null, node.slice(1));
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

	nodeTranformFunctions['.lit'] = function(val){
		return {type: 'Literal', value: val}
	}
	nodeTranformFunctions['.t'] = function(name){
		return {type: 'Identifier', name: encodeTNames(name)}
	}
	nodeTranformFunctions['.unit'] = function(name){
		return {type: 'UnaryExpression', operator:'void', prefix: true, argument: {type: 'Literal', value: 0}}
	}
	nodeTranformFunctions['.declare'] = function(name){
		return transform(['.unit'])
	}
	nodeTranformFunctions['.declare-const'] = function(name){
		return transform(['.unit'])
	}
	nodeTranformFunctions['.args'] = function(name){
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
			nodeTranformFunctions[operator] = function(left, right){
				return {
					type: spiderMonkeyNodeType,
					left: transform(left),
					right: transform(right),
					operator: operator
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
	binop('==', '!==')
	binop('=~', '==')
	binop('!~', '!=')
	logop('&&')
	logop('||')
	assop('=')
	nodeTranformFunctions['.'] = function(left, right){
		return {
			type: 'MemberExpression',
			object: transform(left),
			property: transform(right),
			computed: true
		}
	}
	nodeTranformFunctions['.obj'] = function(){
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
	nodeTranformFunctions['.list'] = function(){
		return {
			type: 'ArrayExpression',
			elements: ArgsToArray(arguments).map(transform)
		}
	}
	nodeTranformFunctions['.seq'] = function(){
		return {
			type: 'BlockStatement',
			body: ArgsToArray(arguments).map(aStatement)
		}
	}
	nodeTranformFunctions['.local'] = function(){
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
	nodeTranformFunctions['.if'] = function(condition, thenPart, elsePart){
		return {
			type: 'IfStatement',
			test: transform(condition),
			consequent: aStatement(thenPart),
			alternate: elsePart ? aStatement(elsePart) : null
		}
	}
	nodeTranformFunctions['.while'] = function(condition, body){
		return {
			type: 'WhileStatement',
			test: transform(condition),
			body: aStatement(body)
		}
	}
	nodeTranformFunctions['.fn'] = function(parameters, body) {
		return {
			type: 'FunctionExpression',
			params: parameters.slice(1).map(transform),
			body: {
				type: 'BlockStatement',
				body: [aStatement(body)]
			},
			expression: false,
			generator: false
		}
	}
	nodeTranformFunctions['.return'] = function(expr) {
		return {
			type: 'ReturnStatement',
			argument: transform(expr)
		}
	}


	return transform
}