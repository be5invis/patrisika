/// Pass Resolve Variable Scoping

var recurse = require('../common/node-types.js').recurse
var nodeIsOperation = require('../common/node-types').nodeIsOperation
var formAssignment = require('../common/patterns').formAssignment
var util = require('util')

exports.Pass = function(config) {
	var mt = require('../common/tempname').TMaker('xit');
	var mta = require('../common/tempname').TMaker('xia');
	var ml = require('../common/tempname').TMaker('xil');
	var expandIIFE = function(node, aux, parent){
		if(!node) return node;
		if(nodeIsOperation(node)) {
			if(node[0] === '.fn') {
				recurse(node, expandIIFE, null);
				return node;
			} else if(node[0] === '.local' && aux) {
				// [.local alpha beta] -> [.seq [.local alpha beta] [= alpha [.unit]] [= beta [.unit]]]
				return ['.seq', node].concat(node.slice(1).map(function(name){
//					if(typeof name === 'string')
						return ['=', name, ['.unit']]
//					else 
//						return ['.unit']
				}))
			} else if(node[0] === '.return' && aux) {
				return ['.seq', 
					['=', aux.tid, expandIIFE(node[1], aux, node)],
					['.break', aux.lid]
				]
			} else if(node[0] === '.args' && aux) {
				return [['.', aux.aid, 'slice'], ['.lit', 0]]
			} else if(node[0] === '.this' && aux) {
				return ['.lit', null]
			} else {
				recurse(node, expandIIFE, aux)
				return node;		
			}
		} else if(node instanceof Array) {
			recurse(node, expandIIFE, aux);
			if(nodeIsOperation(node[0]) && node[0][0] === '.fn' && nodeIsOperation(node[0][1]) && node[0][1][0] === '.list') {
				var fn = node[0];
				/// There are two situations which an IIFE could be expanded safely:
				/// A. An IIFE which its callee does not have nested scopes.
				/// B. An IIFE with NO parameters and NO local variables.
				if((!fn.scope.children.length || (!fn.scope.locals.length && fn[1].length === 1 && node.length === 1))) {
					///IIFE expansion
					var t = mt();   // T for return value
					var l = ml();   // T for label
					var ta = mta(); // T for argument list
					var result = ['.seq', 
						(fn[1].length > 1 ? ['.local'].concat(fn[1].slice(1)) : ['.unit']), // Declaration for function parameters
						['=', t, ['.unit']], // Clear return value
						(node.length > 1 ? ['=', ta, ['.list'].concat(node.slice(1))] : ['=', ta, ['.list']]), // Bind arguments list
						(fn[1].length > 1 ? ['.seq'].concat(fn[1].slice(1).map(function(name, j){
							return ['=', name, ['.', ta, ['.lit', j]]]
						})) : ['.unit']),
						['.label', l, ['.seq', 
							expandIIFE(fn[2], {tid: t, lid: l, aid: ta}, fn),
							['=', t, ['.unit']]
						]],
						t // Return value of this IIFE
					];
					if(fn.scope.parent && fn.scope.parent.children) {
						var a = []
						for(var j = 0; j < fn.scope.parent.children.length; j++)
							if(fn.scope.parent.children[j] !== fn.scope)
								a.push(fn.scope.parent.children[j])
						fn.scope.parent.children = a;
					};
					return result;
				} else {
					return node;
				}
			} else {
				return node;
			}
		} else {
			return node;
		}
	}
	return function(node){
		return expandIIFE(node, null);
	}
}