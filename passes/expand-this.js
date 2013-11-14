/// Pass Expand this
/// abbr. xti
/// In this pass we convert .this nodes into .t nodes
/// And add a [= [.t] [.this]] node in the beginning of
/// functions containing [.this] nodes

var Rules = require('../common/pass').Rules;
var recurse = require('../common/node-types.js').recurse
var nodeIsOperation = require('../common/node-types').nodeIsOperation
var Hash = require('../common/hash').Hash

exports.Pass = function(config) {
	var mt = require('../common/tempname').TMaker('xti');
	var expandThis = Rules(
		[['.fn', '...'], function(node){ 
			node.tThis = mt();
			expandThis(node[2], node);
			if(node.thisOccurs) node[2] = ['.seq', ['=', node.tThis, ['.this']], node[2]]
		}],
		[['.this'], function(node, scope){
			scope.thisOccurs = true;
			return scope.tThis
		}]);

	return function(node){
		return expandThis(node, [])
	}
}