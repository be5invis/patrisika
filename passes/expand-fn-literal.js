/// Pass Expand Function Literals
/// abbr. xfl
/// In this pass, parameters of Function literals are simplified into
/// [.list (id | [.t id])*]

var APassFor = require('../common/pass').APassFor
var mt = require('../common/tempname').TMaker('xfl')
var nodeIsOperation = require('../common/node-types').nodeIsOperation
var recurse = require('../common/node-types').recurse
var formAssignment = require('../common/patterns').formAssignment

exports.Pass = APassFor('.fn', function(node){
	var parameters = node[1];
	var body = node[2];
	if(!(parameters instanceof Array && parameters.length === 0) && (!nodeIsOperation(parameters) || parameters[0] !== '.list')) {
		/// functions with parameter involving the whole arguments
		body = ['.seq', formAssignment(parameters, ['.args'], true, true), body]
		parameters = ['.list']
		return ['.fn', parameters, body]
	} else {
		/// "regular" multiple-parameter function
		var jFirstIrregularNode;
		var jFirstOptionalNode;
		for(var j = 1; j < parameters.length; j++) {
			if(typeof parameters[j] !== 'string' && !jFirstIrregularNode){
				jFirstIrregularNode = j;
			};
			if(nodeIsOperation(parameters[j]) && parameters[j][0] === '.optp') {
				if(!jFirstOptionalNode) {
					jFirstOptionalNode = j;
				}
			} else if (jFirstOptionalNode) {
				throw ['This parameter must be optional.', parameters]
			}
		};
		if(jFirstIrregularNode) {
			/// ensures that jFirstIrregularNode <= jFirstOptionalNode
			if(!jFirstOptionalNode) {
				jFirstOptionalNode = parameters.length;
			}
			var tArgs = mt();
			var sBindings = ['.seq', formAssignment(tArgs, ['.args'], true, true)];
			for(var j = jFirstIrregularNode; j < jFirstOptionalNode; j++) {
				var t = mt();
				sBindings.push(formAssignment(parameters[j], t, true, true));
				parameters[j] = t;
			};
			for(var j = jFirstOptionalNode; j < parameters.length; j++) {
				var t = mt();
				sBindings.push(['.if', 
					['<', ['.', tArgs, ['.lit', 'length']], ['.lit', j]],
					formAssignment(t, parameters[j][2], true, true)
				]);
				sBindings.push(formAssignment(parameters[j][1], t, true, true))
				parameters[j] = t;
			}

			body = ['.seq', sBindings, body];
			return ['.fn', parameters, body]
		} else {
			return node;
		}
	}
})