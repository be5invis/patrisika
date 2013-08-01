/// Pass Expand Assignments
/// abbr. xa
/// In this pass, assignments will be simplified into 3 forms below
/// [= id val]
/// [= [.t id] val]
/// [= [. obj prop] val]


var recurse = require('../common/node-types.js').recurse;
var nodeIsOperation = require('../common/node-types').nodeIsOperation;
var formAssignment = require('../common/patterns.js').formAssignment;

exports.Pass = function(config) {
	var xa = function(node){
		if(!(node instanceof Array)) return node;
		recurse(node, xa);
		if(node[0] === '=') {
			return formAssignment(node[1], node[2])
		} else {
			return node;
		}
	}

	return xa;
}