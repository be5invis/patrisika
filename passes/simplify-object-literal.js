/// Pass Simplify Object Literals
/// abbr. sol
/// In this pass, object literals are simplified into init-pair only.

var Hash = require('../common/hash').Hash;
var mt = require('../common/tempname').TMaker('sol');
var mt = require('../common/tempname').TMaker('sol');
var nodeIsOperation = require('../common/node-types.js').nodeIsOperation;
var recurse = require('../common/node-types.js').recurse;

exports.Pass = function(){
	var sol = function(node){
		if(!(node instanceof Array)) return node;
		recurse(node, sol);
		if(node[0] === '.obj') {
			var foundAccessorProperty = false;
			var foundIrregularAccessorBind = false;
			for(var j = 1; j < node.length; j++){
				if(node[j][2] === 'get' || node[j][2] === 'set'){
					foundAccessorProperty = true;
					if(!(nodeIsOperation(node[j][1]) && node[j][1] === '.fn')) {
						foundIrregularAccessorBind = true
					}
				}
			}
			if(foundAccessorProperty) {
				// Remember: An object literal DURING initialization cannot be accessed
				// Therefore we CAN delay property writing safely, while preserving the
				// values in their original order.

				// STEP I. Find the first accessor item
				var jFirstAccessor = 0
				for(var j = 1; j < node.length; j++) {
					if(node[j][2] === 'get' || node[j][2] === 'set') {
						jFirstAccessor = j;
						break;
					}
				}
				// jFirstAccessor MUST be positive (> 0).
				var hAccessorProperties = new Hash;
				// Create a T-variable, representing the object being created.
				var t = mt();
				var nPropertiesBeforeAccessor = node.slice(0, jFirstAccessor);
				var s = ['.seq', ['.declt', t], ['=', t, nPropertiesBeforeAccessor]];
				for(var j = jFirstAccessor; j < node.length; j++){
					if(node[j][2] === 'get' || node[j][2] === 'set'){
						var pair = hAccessorProperties.get(node[j][0])
						if(!pair) pair = {get: ['.lit', null], set: ['.lit', null]}
						var tProp = mt();
						s.push(['.seq', ['.declt', tProp], ['=', 
							tProp,
							node[j][1]
						]])
						pair[node[j][2]] = tProp;
						hAccessorProperties.put(node[j][0], pair);
					} else {
						// A common property
						s.push(['=', 
							['.', t, ['.lit', node[j][0]]], 
							node[j][1]
						])
					}
				}
				hAccessorProperties.forEach(function(key, value) {
					s.push([['.', 'Object', ['.lit', 'defineProperty']], t, ['.lit', key], ['.obj', 
						['get', value.get || ['.lit', null]],
						['set', value.set || ['.lit', null]]
					]])
				});
				s.push(t);
				return s;
			} else {
				return node;
			}
		} else {
			return node;
		}
	}
	return sol;
}