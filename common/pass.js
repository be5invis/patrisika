var recurse = require('./node-types.js').recurse;

var composite = function(passes, config){
	var steps = [];
	for(var j = 0; j < passes.length; j++){
		steps[j] = passes[j].Pass(config)
	}
	return function(node){
		for(var j = 0; j < steps.length; j++){
			node = steps[j](node)
		}
		return node;
	}
}
exports.composite = composite;

var APassFor = function(type, handler){
	return function(config) {
		var f = function(node){
			if(!(node instanceof Array)) return node;
			recurse(node, f);
			if(node[0] === type) {
				try {
					return handler(node)
				} catch(situation) {
					if(situation instanceof Array){
						throw config.createError(situation[0], situation[1] || node)
					} else if(typeof situation === 'string') {
						throw config.createError(situation, node)
					} else {
						throw situation
					}
				}
			} else {
				return node;
			}
		}

		return f;
	}
}
exports.APassFor = APassFor;