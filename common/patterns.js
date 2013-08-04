var nodeIsOperation = require('./node-types.js').nodeIsOperation;
var mt = require('./tempname').TMaker('pt');

var formAssignment = function(left, right, isDeclarative, isConstant){
	if(!left || !right) throw "Invalid Assignment!"
	if(typeof left === 'string') {
		// Set an variable
		var sAssignment = ['=', left, right]
		if(isDeclarative) {
			if(isConstant) {
				return ['=c', left, right]
			} else {
				sAssignment = ['.seq', ['.declare', left], sAssignment]
			}
		}
		return sAssignment
	} else if(nodeIsOperation(left)) {
		if(left[0] === '.t') {
			if(isDeclarative) return ['.seq', ['.declare', left], ['=', left, right]]
			else return ['=', left, right];
		} else if(left[0] === '.') {
			/// TODO: add constant property set support
			return ['=', left, right]
		} else if(left[0] === '.list') {
			var tList = mt()
			var sAssignment = ['.seq', ['=', tList, right]]
			for(var j = 1; j < left.length; j++){
				sAssignment.push(formAssignment(left[j], ['.', tList, ['.lit', (j - 1)]], isDeclarative, isConstant))
			}
			sAssignment.push(tList);
			return sAssignment
		} else if(left[0] === '.obj') {
			var tObj = mt()
			var sAssignment = ['.seq', ['=', tObj, right]]			
			for(var j = 1; j < left.length; j++){
				if(left[j][2] === 'get' || left[j][2] === 'set') {
					throw 'Invalid Object Pattern'
				}
				sAssignment.push(formAssignment(left[j][1], ['.', tObj, ['.lit', left[j][0]]], isDeclarative, isConstant))
			}
			sAssignment.push(tObj)
			return sAssignment
		} else {
			throw 'Invalid Pattern'
		}
	} else {
		/// [= [f alpha beta] val] => [= [.list alpha beta] [[. f unapply] val]]
		return formAssignment(
			['.list'].concat(left.slice(1)), 
			[['.', left[0], ['.lit', 'unapply']], right, ['.lit', left.length - 1]], 
			isDeclarative, isConstant)
	}
}

exports.formAssignment = formAssignment;