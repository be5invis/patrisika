// Regular-nestize AST nodes.
// In JavaScript, only statements can contain other statements.
// Therefore this pass will convert "freely nested" AST into regular
// nested AST.

var Hash = require('../common/hash').Hash
var mt = require('../common/tempname').TMaker('rn')
var TYPE = 0
var nodeIsStatemental = require('../common/node-type-catalog').nodeIsStatemental;
var nodeIsLiteral = require('../common/node-type-catalog').nodeIsLiteral;
var nodeIsOperation = require('../common/node-type-catalog').nodeIsOperation;

var bv = function(t, X) {
	if(!nodeIsOperation(X)) return ['=', t, X];
	switch(X[TYPE]) {
		case '.seq' : {
			X[X.length - 1] = bv(t, X[X.length - 1])
			return X
		}
		case '.if' : {
			X[2] = bv(t, X[2])
			if(X[3]) X[3] = bv(t, X[3])
			return X
		}
		case '.while' : {
			return ['.seq', X, ['=', t, ['.lit', undefined]]]
		}
		case '.return' : {
			// Binding value of an return statement is meaningless.
			return X
		}
		default : {
			return ['=', t, X]
		}
	}
}
var rn = function(node){
	if(!node || typeof node === 'string' || typeof node[0] !== 'string') return node;
	switch(node[TYPE]) {
		case '.lit' :
		case '.id' :
		case '.t' : {
			return node
		}
		case '.fn' : {
			node[2] = rn(node[2])
			return node
		}
		case '.seq' : {
			for(var j = 1; j < node.length; j++) {
				node[j] = rn(node[j])
			}
			return node;
		}
		case '.if' : {
			// [operator, E, S, S]
			for(var j = 1; j < node.length; j++) {
				node[j] = rn(node[j])
			}
			if(nodeIsStatemental(node[1])) {
				var t = mt();
				var binding = bv(t, node[1])
				node[1] = t;
				return ['.seq', binding, node]
			} else {
				return node;
			}
		}
		case '.while' : {
			// [operator, EXPRESSIONAL CONDITION, STATEMENTAL BODY]
			// Note that if CONDITION is statemental, the result it transformed should be appended
			// to the BODY
			for(var j = 1; j < node.length; j++) {
				node[j] = rn(node[j])
			}
			if(nodeIsStatemental(node[1])) {
				var t = mt();
				var binding = bv(t, node[1])
				node[1] = t;
				node[2] = ['.seq', node[2], binding];
				return ['.seq', binding, node];
			} else {
				return node;
			}
		}
		case '.obj' : {
			// The structure of [.obj] node is [.obj [key1 val1] [key2 val2]]
			// Therefore, transform it to reuse the code below
			var _values = ['.obj.vals'].concat(node.slice(1).map(function(a){return a[1]}))
			_values = rn(_values);
			if(_values[0] === '.obj.vals') {
				for(var j = 1; j < node.length; j++){
					node[j][1] = _values[j]
				}
				return node
			} else {
				// _values contains BVs, its operator must be [.seq]
				var _f = _values[_values.length - 1]
				for(var j = 1; j < _f.length; j++){
					node[j][1] = _f[j]
				}
				_values[_values.length - 1] = node;
				return _values;
			}
		}
		default : {
			// For most cases, members of an AST node should be ALL EXPRESSIONAL.
			// Including statemental node '.return'

			var hasStatementSub = false
			// Step 1 : rn-ize its parts + check whether statement-level member exists
			for(var j = 1; j < node.length; j++) {
				node[j] = rn(node[j])
				hasStatementSub = hasStatementSub || nodeIsStatemental(node[j])
			}
			// Step 2 : if there is no statement-level members, return it
			if(!hasStatementSub) return node
			// Step 3 : An standarized transformation
			var a = []
			for(var j = 1; j < node.length; j++) if(!nodeIsLiteral(node[j])) {
				var t = mt();
				a[j] = bv(t, node[j]);
				node[j] = t;
			}
			a[TYPE] = '.seq';
			a.push(node);
			return a;
		}
	}
}

exports.rn = rn;