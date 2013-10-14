/// Pass Expand Try-catch
/// abbr. xtc
/// In this pass we convert the 2nd argument of .try nodes into
/// a .t node.

var APassFor = require('../common/pass').APassFor
var mt = require('../common/tempname').TMaker('xtc')
var recurse = require('../common/node-types').recurse
var nodeIsOperation = require('../common/node-types').nodeIsOperation
var formAssignment = require('../common/patterns').formAssignment

exports.Pass = APassFor([['.try', '...'], function(node){
	var t = mt();
	node[3] = ['.seq', 
		['.def', t, node[2]],
		node[3]]
	node[2] = t;
	return node;
}]);