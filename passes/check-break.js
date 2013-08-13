var recurse = require('../common/node-types.js').recurse
var nodeIsOperation = require('../common/node-types').nodeIsOperation
var Hash = require('../common/hash').Hash

exports.Pass = function(config) {
	var n = 0;
	var checkBreak = function(node, stack){
		if(!node) return node;
		if(nodeIsOperation(node)) {
			if(node[0] === '.fn') {
				checkBreak(node[2], new Hash());
				return node
			} /*else if(node[0] === '.try') {
				checkBreak(node[1], new Hash());
				checkBreak(node[3], new Hash());
				return node
			} */else if(node[0] === '.label') {
				var stack_ = Object.create(stack);
				n++;
				stack_.put(node[1], ('_LABEL_' + n));
				node[1] = stack_.get(node[1]);
				checkBreak(node[2], stack_);
				return node;
			} else if(node[0] === '.break') {
				if(!stack.get(node[1])) {
					throw config.createError("Target of this break statement not found.", node)
				} else {
					node[1] = stack.get(node[1])
				}
				return node;
			} else {
				recurse(node, checkBreak, stack)
				return node;		
			}
		} else if(node instanceof Array) {
			recurse(node, checkBreak, stack)
			return node;
		} else {
			return node;
		}
	}

	return function(node){
		return checkBreak(node, new Hash())
	}
}