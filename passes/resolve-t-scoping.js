/// Pass Resolve T Scoping
/// In Ptrisika, we often introduce T-variables to store intermediate values. 
/// In this pass, all T-variables are "declared", and forms an [.local] node
/// for every scopes containing T-variables.  [.declare [.t id]] nodes are removed in 
/// this pass. After this pass, there should be no more T-variables introduced.

var Rules = require('../common/pass').Rules;
var recurse = require('../common/node-types.js').recurse
var Hash = require('../common/hash').Hash
var nodeIsOperation = require('../common/node-types').nodeIsOperation

exports.Pass = function(config) {
	var rts = Rules(
		['.declare', function(node, env){ 
			if(nodeIsOperation(node[1]) && node[1][0] === '.t') {
				env.put(node[1][1], true);
				return ['.unit']
			}
		}],
		['.fn', function(node, env){
			var env_ = Object.create(env);
			rts(node[2], env_);
			var localTs = []
			env_.forEach(function(id){localTs.push(['.t', id])});
			if(localTs.length) {
				node[3] = (node[3] || ['.local']).concat(localTs)
			}			
		}]
	)

	return function(node){
		return rts(node, new Hash())
	};
}