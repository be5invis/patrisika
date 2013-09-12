/// Pass Regular-nestize AST nodes.
/// abbr. rn
/// In JavaScript, only statements can contain other statements.
/// Therefore this pass will convert "freely nested" AST into regular
/// nested AST.

var Hash = require('../common/hash').Hash
var nodeIsStatemental = require('../common/node-types').nodeIsStatemental
var nodeIsLiteral = require('../common/node-types').nodeIsLiteral
var nodeIsOperation = require('../common/node-types').nodeIsOperation
var nodeIsName = require('../common/node-types').nodeIsName
var cloneNode = require('../common/clone-node').cloneNode
var Symbol = require('../common/scope').Symbol

var TYPE = 0

exports.Pass = function(config) {
	var mt = require('../common/tempname').TMaker('rn');
	var bv = function(t, X) {
		// Function bv: Bind T-variable t to the "value" of node X
		if(!nodeIsOperation(X)) return ['=', t, X];
		switch(X[TYPE]) {
			case '.seq' : {
				X = X.slice(0);
				X[X.length - 1] = bv(t, X[X.length - 1])
				return X
			}
			case '.if' : {
				X = X.slice(0);
				X[2] = bv(t, X[2])
				if(X[3]) X[3] = bv(t, X[3])
				return X
			}
			case '.try' : {
				X = X.slice(0);
				X[1] = bv(t, X[1])
				return X
			}
			case '.while' : 
			case '.break' : {
				return ['.seq', X, ['=', t, ['.unit']]]
			}
			case '.return' : {
				// Binding value of an return statement is meaningless.
				return X
			}
			case '.label' : {
				X[2] = bv(t, X[2])
				return X;
			}
			case '.unit' :
			case '.declare' : {
				return X
			}
			default : {
				return ['=', t, X]
			}
		}
	}
	var bvPush = function(node, sequence) {
		var t = mt();
		sequence.push(['.seq', ['.declare', t], bv(t, node)])
		return t;
	}
	var bvMemberPush = function(node, sequence) {
		var t1 = mt();
		sequence.push(['.seq', ['.declare', t1], bv(t1, node[1])])
		var t2 = mt();
		sequence.push(['.seq', ['.declare', t2], bv(t2, node[2])])
		return ['.', t1, t2];
	}
	var CHECK_FIRST_SUBITEM_IS_MEMBERING = true;
	var rnRegular = function(node, jStart, checkFirstIsMemberNode){
		var hasStatementSub = false
		var isMethodCall = false
		// Step 1 : rn-ize its parts + check whether statement-level member exists
		for(var j = jStart; j < node.length; j++) {
			if(checkFirstIsMemberNode && j === jStart && nodeIsOperation(node[j]) && node[j][0] === '.') {
				// Special processing for callee of an invocation
				node[j][1] = rn(node[j][1])
				node[j][2] = rn(node[j][2])
				isMethodCall = true;
				hasStatementSub = hasStatementSub || nodeIsStatemental(node[j][1]) || nodeIsStatemental(node[j][2])
			} else {
				node[j] = rn(node[j])
				hasStatementSub = hasStatementSub || nodeIsStatemental(node[j])
			}
		}
		// Step 2 : if there is no statement-level members, return it
		if(!hasStatementSub) return node
		// Step 3 : An standarized transformation
		var a = []
		for(var j = jStart; j < node.length; j++) if(!nodeIsLiteral(node[j])) {
			if(j === jStart && isMethodCall) {
				node[j] = bvMemberPush(node[j], a)
			} else {
				node[j] = bvPush(node[j], a)
			}
		}
		a.unshift('.seq');
		a.push(node);
		return a;
	}
	var rn = function(node){
		if(!node || typeof node === 'string' || node instanceof Symbol) return node;
		if(!nodeIsOperation(node)) return rnRegular(node, 0, CHECK_FIRST_SUBITEM_IS_MEMBERING);
		switch(node[TYPE]) {
			case '.lit' :
			case '.break' :
			case '.id' :
			case '.t' :
			case '.x' : {
				return node
			}
			case '.fn' : {
				node[2] = ['.seq', rn(node[2])]
				return node
			}
			case '.label' : {
				node[2] = ['.seq', rn(node[2])]
				return node
			}
			case '.seq' : {
				if(node.length === 1) {
					return ['.unit']
				} else if(node.length === 2) {
					return rn(node[1])
				}
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
					return ['.seq', ['.declare', t], binding, node]
				} else {
					return node;
				}
			}
			case '.try' : {
				// [operator, S, (e), S]
				for(var j = 1; j < node.length; j++) {
					node[j] = rn(node[j])
				}
				node[1] = ['.seq', node[1]];
				return node
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
					node[2] = ['.seq', node[2], cloneNode(binding)];
					return ['.seq', ['.declare', t], binding, node];
				} else {
					node[2] = ['.seq', node[2]]
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
			case '=' : {
				if(nodeIsName(node[1])) {
					node[2] = rn(node[2]);
					if(nodeIsStatemental(node[2])) {
						var t = mt();
						var binding = bv(t, node[2]);
						node[2] = t;
						return ['.seq', ['.declare', t], binding, node]
					} else {
						return node;
					}
				} else {
					return rnRegular(node, 1, CHECK_FIRST_SUBITEM_IS_MEMBERING);
				}
			}
			default : return rnRegular(node, 1);
		}
	}
	return rn
}