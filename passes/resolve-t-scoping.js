/// Pass Resolve T Scoping
/// In Ptrisika, we often introduce T-variables to store intermediate values. 
/// In this pass, all T-variables are "declared", and forms an [.local] node
/// for every scopes containing T-variables.  [.declt] nodes are removed in 
/// this pass. After this pass, there should be no more T-variables introduced.

var recurse = require('../common/node-types.js').recurse;
var Hash = require('../common/hash').Hash

exports.Pass = function(config) {

	var rts = function(node, env){
		if(!node || !(node instanceof Array)) return node;
		if(node[0] === '.fn'){
			var env_ = Object.create(env);
			rts(node[2], env_);
			var localTs = []
			env_.forEach(function(id){localTs.push(['.t', id])});
			if(localTs.length) {
				node[2] = ['.seq', ['.local'].concat(localTs), node[2]];
			}
			return node;
		} else if(node[0] === '.declt'){
			env.put(node[1][1], true);
			return ['.unit'];
		} else {
			recurse(node, rts, env);
			return node;
		}
	}

	return function(node){
		return rts(node, new Hash())
	};
}