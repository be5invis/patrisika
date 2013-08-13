/// Pass Expand Try-catch
/// abbr. xtc

var APassFor = require('../common/pass').APassFor
var mt = require('../common/tempname').TMaker('xtc')
var recurse = require('../common/node-types').recurse
var nodeIsOperation = require('../common/node-types').nodeIsOperation
var formAssignment = require('../common/patterns').formAssignment

exports.Pass = APassFor('.try', function(node){
	var t = mt();
	node[3] = ['.seq', 
		formAssignment(t, node[2], true, true),
		node[3]]
	node[2] = t;
	return node;
});