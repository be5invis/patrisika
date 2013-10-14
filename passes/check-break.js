
var Rules = require('../common/pass').Rules;
var recurse = require('../common/node-types.js').recurse
var nodeIsOperation = require('../common/node-types').nodeIsOperation
var Hash = require('../common/hash').Hash

exports.Pass = function(config) {
	var n = 0;
	var checkBreak = Rules(
		[['.fn', '...'], function(node){ checkBreak(node[2], new Hash()) }],
		[['.label', '*', '*'], function(node, stack) {
			var stack_ = Object.create(stack);
			n++;
			stack_.put(node[1], ('_LABEL_' + n));
			node[1] = stack_.get(node[1]);
			checkBreak(node[2], stack_);
			return node;			
		}],
		[['.break', '*'], function(node, stack) {
			if(!stack.get(node[1])) {
				throw config.createError("Target of this break statement not found.", node)
			} else {
				node[1] = stack.get(node[1])
			}
			return node;
		}])

	return function(node){
		return checkBreak(node, new Hash())
	}
}