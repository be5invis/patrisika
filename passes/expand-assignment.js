/// Pass Expand Assignments
/// abbr. xa
/// In this pass, assignments will be simplified into 3 forms below
/// [= id val]
/// [= [.t id] val]
/// [= [. obj prop] val]

var APassFor = require('../common/pass').APassFor
var recurse = require('../common/node-types').recurse
var nodeIsOperation = require('../common/node-types').nodeIsOperation
var formAssignment = require('../common/patterns').formAssignment

exports.Pass = APassFor('=', function(node){
	return formAssignment(node[1], node[2], node[3], node[4])
});