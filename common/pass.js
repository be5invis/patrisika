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
	'#leaf' : function(node){return nodeIsLeaf(node)}
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
		} else if(type instanceof Function) {
			var mf = type;
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
var Rules_ = function() {
	var fn = _PassFn(function(node){return node})
	for(var j = 0; j < arguments.length; j++) {
		var type = arguments[j][0], g = arguments[j][1];
		fn = fn.For(type, g)
	}
	return fn
}
var Rules = function() {
	var fn = _PassFn(function(node){return node})
			.For('**', function(node, aux){ recurse(node, fn, aux) })
	for(var j = 0; j < arguments.length; j++) {
		var type = arguments[j][0], g = arguments[j][1];
		fn = fn.For(type, g)
	}
	return fn
}
var APassFor = function(){
	var handlers = arguments;
	return function(config) {
		return Rules.apply(null, handlers);
	}
}
exports.APassFor = APassFor;
exports.Rules_ = Rules_;
exports.Rules = Rules;