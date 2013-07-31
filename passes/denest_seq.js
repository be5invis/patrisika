var recurse = require('../common/node-type-catalog.js').recurse;

var ds = function(node){
	if(!(node instanceof Array)) return node;
	recurse(node, ds);
	if(node[0] === '.seq') {
		var a = [];
		for(var j = 1; j < node.length; j++) {
			if(node[j] instanceof Array && node[j][0] === '.seq') {
				a = a.concat(node[j].slice(1))
			} else {
				a.push(node[j])
			}
		}
		return ['.seq'].concat(a)
	} else {
		return node;
	}
}

exports.ds = ds;