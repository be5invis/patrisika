var recurse = require('../common/node-types.js').recurse
var nodeIsOperation = require('../common/node-types').nodeIsOperation
var Hash = require('../common/hash').Hash

exports.Pass = function(config) {
	var mt = require('../common/tempname').TMaker('xti');
	var expandThis = function(node, scope){
		if(!node) return node;
		if(nodeIsOperation(node)) {
			if(node[0] === '.fn') {
				node.tThis = mt();
				expandThis(node[2], node);
				if(node.thisOccurs) node[2] = ['.seq', ['=', node.tThis, ['.this']], node[2]]
				return node
			} else if(node[0] === '.this') {
				scope.thisOccurs = true;
				return scope.tThis
			} else {
				recurse(node, expandThis, scope)
				return node;		
			}
		} else if(node instanceof Array) {
			recurse(node, expandThis, scope)
			return node;
		} else {
			return node;
		}
	}

	return function(node){
		return expandThis(node, [])
	}
}