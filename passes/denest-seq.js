/// Pass denesting [.seq]
/// abbr. ds
/// In preverous passes we OFTEN generates nesting [.seq] nodes, and they are
/// flattened in this pass.


var recurse = require('../common/node-types.js').recurse;
var nodeIsOperation = require('../common/node-types').nodeIsOperation;

exports.Pass = function(config) {
	var ds = function(node){
		if(!(node instanceof Array)) return node;
		recurse(node, ds);
		if(node[0] === '.seq') {
			var a = [];
			for(var j = 1; j < node.length; j++) {
				if(nodeIsOperation(node[j]) && node[j][0] === '.seq') {
					a = a.concat(node[j].slice(1))
				} else if (nodeIsOperation(node[j]) && j < node.length - 1 && (
					node[j][0] === '.unit'
					|| node[j][0] === '.t'
					|| node[j][0] === '.fn'
				)) {
					// Remove non-side-effective subitems before the last item.
				} else {
					a.push(node[j])
				}
			}
			if(!a.length) a = [['.unit']]
			return ['.seq'].concat(a)
		} else {
			return node;
		}
	}

	return ds;
}