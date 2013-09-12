var recurse = require('./node-types.js').recurse;
var nodeIsOperation = require('./node-types.js').nodeIsOperation;
var nodeIsLeaf = require('./node-types.js').nodeIsLeaf;

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
var NodeMatchingFunctions = {
	'*' : function(){return true},
	'**' : function(node){return node instanceof Array && !nodeIsLeaf(node)},
	'#call' : function(node){return node instanceof Array && !nodeIsOperation(node)},
	'#op' : function(node){return nodeIsOperation(node)},
}
var _PassFn = function(f) {
	f.For = function(type, g) {
		var fn = this;
		if(NodeMatchingFunctions[type]) {
			var mf = NodeMatchingFunctions[type];
			return _PassFn(function(node){
				if(mf(node)) 
					return g.apply(this, arguments) || node
				else 
					return fn.apply(this, arguments) || node
			})
		} else {
			return _PassFn(function(node){
				if(nodeIsOperation(node) && node[0] === type) 
					return g.apply(this, arguments) || node
				else 
					return fn.apply(this, arguments) || node
			})
		}
	};
	return f;
}
var Rules = function() {
	var fn = _PassFn(function(node){return node})
	for(var j = 0; j < arguments.length; j++) {
		var type = arguments[j][0], g = arguments[j][1];
		fn = fn.For(type, g)
	}
	return fn
}
var APassFor = function(_handlers){
	var types = []
	var handlers = []
	for(var type in _handlers) if(_handlers[type] instanceof Function) {
		types.push(type);
		handlers.push(_handlers[type]);
	}
	return function(config) {
		var f = function(node){
			if(!(node instanceof Array)) return node;
			recurse(node, f);
			for(var k = 0; k < types.length; k++) {
				if(node[0] === types[k]) {
					try {
						return handlers[k](node)
					} catch(situation) {
						if(situation instanceof Array){
							throw config.createError(situation[0], situation[1] || node)
						} else if(typeof situation === 'string') {
							throw config.createError(situation, node)
						} else {
							throw situation
						}
					}					
				}
			}
			return node;
		}

		return f;
	}
}
exports.APassFor = APassFor;
exports.Rules = Rules;