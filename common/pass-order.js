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