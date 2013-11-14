/// Pass Rules Assignments
/// abbr. xa
/// In this pass, assignments will be simplified into 3 forms below
/// [= id val]
/// [= [.t id] val]
/// [= [. obj prop] val]

var APassFor = require('../common/pass').APassFor
var recurse = require('../common/node-types').recurse
var nodeIsOperation = require('../common/node-types').nodeIsOperation
var formAssignment = require('../common/patterns').formAssignment

exports.Pass = APassFor(
	[['=', '...'], function(node){
		return formAssignment(node[1], node[2], false, false)
	}],
	[['.var', '...'], function(node){
		return formAssignment(node[1], node[2], true, false)
	}],
	[['.def', '...'], function(node){
		return formAssignment(node[1], node[2], true, true)
	}]
);