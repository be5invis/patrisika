var nodeTranformFunctions = {}
var nodeIsStatemental = require('../common/node-type-catalog.js').nodeIsStatemental;
var encodeCommonNames = require('../common/tempname').encodeCommonNames
var encodeTNames = require('../common/tempname').encodeTNames

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
nodeTranformFunctions['.seq'] = function(){
	return {
		type: 'BlockStatement',
		body: ArgsToArray(arguments).map(aStatement)
	}
}
nodeTranformFunctions['.local'] = function(){
	return {
		type: 'VariableDeclaration',
		delcarations: ArgsToArray(arguments).map(transform),
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
		params: parameters.map(transform),
		body: {
			type: 'BlockStatement',
			body: [aStatement(body)]
		}
	}
}
nodeTranformFunctions['.return'] = function(expr) {
	return {
		type: 'ReturnStatement',
		argument: transform(expr)
	}
}


exports.transform = transform;