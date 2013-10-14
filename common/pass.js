var recurse = require('./node-types').recurse;
var nodeIsOperation = require('./node-types').nodeIsOperation;
var nodeIsLeaf = require('./node-types').nodeIsLeaf;
var Symbol = require('./scope').Symbol

var composite = function(passes, config){
	var steps = [];
	for(var j = 0; j < passes.length; j++){
		steps[j] = passes[j].Pass(config)
	}
	return function(node){
		try {
			for(var j = 0; j < steps.length; j++){
				node = steps[j](node)
			}
			return node;
		} catch(situation) {
			if(situation instanceof Array){
				throw config.createError.apply(null, situation);
			} else {
				throw situation
			}
		}
	}
}
exports.composite = composite;
var NodeMatchingFunctions = {
	'.' : function(){return true},
	'*' : function(){return true},
	'**' : function(node){return node instanceof Array && !nodeIsLeaf(node)},
	'.id' : function(node){return typeof node === 'string'},
	'.symbol' : function(node){return node instanceof Symbol},
	'#call' : function(node){return node instanceof Array && !nodeIsOperation(node)},
	'#op' : function(node){return nodeIsOperation(node)},
	'#leaf' : function(node){return nodeIsLeaf(node)}
}
var NodePattern = function(pattern){
	if(NodeMatchingFunctions[pattern]) return NodePattern(NodeMatchingFunctions[pattern]);
	if(pattern instanceof Function) return function(){ return pattern.apply(this, arguments) };
	if(typeof pattern === 'string') return function(node){ return node === pattern }
	if(pattern instanceof Array) {
		// An complicated pattern
		var dotsOccured = false;
		var subPatterns = []
		for(var j = 0; j < pattern.length; j++) {
			if(pattern[j] === '...') {
				dotsOccured = true;
				break;
			} else {
				subPatterns[j] = NodePattern(pattern[j])
			}
		}
//		console.log(pattern, j, subPatterns);
		var nSubPatterns = j;
		if(dotsOccured) {
			return function(node){
				if(!(node instanceof Array)) return false;
				for(var j = 0; j < nSubPatterns; j++) if(!subPatterns[j](node[j])) return false;
				return true;
			}
		} else {
			return function(node){
				if(!(node instanceof Array) || node.length !== nSubPatterns) return false;
				for(var j = 0; j < nSubPatterns; j++) if(!subPatterns[j](node[j])) return false;
				return true;
			}
		}
	}
}
var _PassFn = function(f) {
	f.For = function(type, g) {
		var fn = this;
		var mf = NodePattern(type);
		return _PassFn(function(node){
			if(mf(node)) 
				return g.apply(this, arguments) || node
			else 
				return fn.apply(this, arguments) || node
		})
	};
	return f;
}
var ErrorHandlingFunction = function(passfn){
	return function(node){
		try {
			return passfn.apply(this, arguments)
		} catch(situation) {
			if(typeof situation === 'string') {
				throw [situation, node]
			} else if(situation instanceof Array) {
				throw situation.concat([node])
			} else {
				throw situation
			}
		}
	}
}
var Rules_ = function() {
	var fn = _PassFn(function(node){return node})
	for(var j = 0; j < arguments.length; j++) {
		var type = arguments[j][0], g = arguments[j][1];
		fn = fn.For(type, g)
	};
	fn = ErrorHandlingFunction(fn);
	return fn
}
var Rules = function() {
	var fn = _PassFn(function(node){return node})
			.For('**', function(node, aux){ recurse(node, fn, aux) })
	for(var j = 0; j < arguments.length; j++) {
		var type = arguments[j][0], g = arguments[j][1];
		fn = fn.For(type, g)
	}
	fn = ErrorHandlingFunction(fn);
	return fn
}
var APassFor = function(){ 
	var _args = arguments;
	return function(config){
		var handlers = [].slice.call(_args, 0).map(function(item){
			var pattern = item[0]
			var _handler = item[1]
			var handler = function(node){
				recurse(node, fn);
				return _handler(node);
			};
			return [pattern, handler]
		});
		var fn = Rules.apply(null, handlers);
		return fn;
	}
}
exports.APassFor = APassFor;
exports.Rules_ = Rules_;
exports.Rules = Rules;