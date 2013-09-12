/// Pass denesting [.seq]
/// abbr. ds
/// In preverous passes we OFTEN generates nesting [.seq] nodes, and they are
/// flattened in this pass.


var Rules = require('../common/pass').Rules;
var recurse = require('../common/node-types').recurse;
var nodeIsOperation = require('../common/node-types').nodeIsOperation;
var nodeIsVariable = require('../common/node-types').nodeIsVariable;

exports.Pass = function(config) {
	var ds = Rules(
		['**', function(node) { recurse(node, ds) }], 
		['.seq', function(node) {
			recurse(node, ds);
			var a = [];
			for(var j = 1; j < node.length; j++) {
				if(nodeIsOperation(node[j]) && node[j][0] === '.seq') {
					a = a.concat(node[j].slice(1))
				} else {
					a.push(node[j])
				}
			};
			var len = a.length - 1;
			a = a.filter(function(item, j){
				return (j === len) || !(nodeIsVariable(item) || (nodeIsOperation(item) && (
					item[0] === '.unit'
					|| item[0] === '.t'
					|| item[0] === '.lit'
					|| item[0] === '.fn'
				)))
			})
			if(!a.length) a = [['.unit']]
			return ['.seq'].concat(a)
		}]);

	return function(node){
		return ds(node)
	};
}