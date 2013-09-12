/// Pass Resolve Variable Scoping

var recurse = require('../common/node-types.js').recurse
var nodeIsOperation = require('../common/node-types').nodeIsOperation
var formAssignment = require('../common/patterns').formAssignment
var util = require('util')
var Symbol = require('../common/scope').Symbol

exports.Pass = function(config) {
	var mt = require('../common/tempname').TMaker('xit');
	var mta = require('../common/tempname').TMaker('xia');
	var ml = require('../common/tempname').TMaker('xil');

	var transformIIFEBody = function(node, aux, parent) {
		if(!node) return node;
		if(nodeIsOperation(node)) {
			if(node[0] === '.fn') {
				return node;
			} else if(node[0] === '.local') {
				// [.local alpha beta] -> [.seq [.local alpha beta] [= alpha [.unit]] [= beta [.unit]]]
				return ['.seq', node, node.slice(1).reduceRight(function(existing, name){
						return ['=', name, existing]
				}, ['.unit'])]
			} else if(node[0] === '.return') {
				aux.hasReturn = true;
				return ['.seq', 
					['=', aux.tid, transformIIFEBody(node[1], aux, node)],
					['.break', aux.lid]
				]
			} else if(node[0] === '.args') {
				aux.hasArgs = true;
				return [['.', aux.aid, 'slice'], ['.lit', 0]]
			} else if(node[0] === '.this') {
				return ['.lit', null]
			} else {
				recurse(node, transformIIFEBody, aux)
				return node;		
			}
		} else if(node instanceof Array) {
			recurse(node, transformIIFEBody, aux)
			return node;
		} else {
			return node;
		}
	}

	var expandIIFE = function(node, ex1){
		if(!node) return node;
		if(nodeIsOperation(node)) {
			if(node[0] === '.fn') {
				node[2] = expandIIFE(node[2], true);
				return node
			} else if(node[0] === '.while') {
				recurse(node, expandIIFE, false);
				return node;
			} else if(node[0] === '.doblock') {
				return expandIIFE([node[1]], ex1)
			} else {
				recurse(node, expandIIFE, ex1)
				return node;		
			}
		} else if(node instanceof Array) {
			recurse(node, expandIIFE, ex1);
			if(config.enableIIFEExpand && nodeIsOperation(node[0]) && node[0][0] === '.fn' && nodeIsOperation(node[0][1]) && node[0][1][0] === '.list') {
				var fn = node[0];
				/// There are two situations which an IIFE could be expanded safely:
				/// A. An IIFE which its callee does not have nested scopes.
				/// B. An IIFE with NO parameters and NO local variables.

				if(fn.scope && (config.enableIIFEExpandExecuteOnce && ex1 || !fn.scope.children.length || (!fn.scope.locals.length && fn[1].length === 1 && node.length === 1))) {
					///IIFE expansion
					var t = mt();   // T for return value
					var l = ml();   // T for label
					var ta = mta(); // T for argument list
					var aux = {tid: t, lid: l, aid: ta}
					var body = transformIIFEBody(fn[2], aux, fn);
					var parameters = fn[1].slice(1);
					var args = node.slice(1);
					var result = ['.seq', 
						(function(){
							var s = ['.seq', ['.unit']]
							var l = ['.local']
							for(var j = 0; j < parameters.length; j++) {
								if(parameters[j] instanceof Symbol) l.push(parameters[j])
								else s.push(['.declare', parameters[j]]);
							}
							if(l.length > 1) s.push(l);
							return s;
						}()), // Declaration for function parameters
						['.declare', ta],
						// Parameters assignment
						(parameters.length ? ['.seq'].concat(parameters.map(function(name, j){
							return ['=', name, args[j] || ['.unit']]
						})) : ['.unit']),
						// Argument-list assignment
						(function(){
							if(aux.hasArgs) {
								var listNode = ['.list'];
								for(var j = 0; j < args.length; j++) {
									listNode.push(parameters[j] || args[j])
								}
								return ['=', ta, [['.', listNode, ['.lit', 'slice']], ['.lit', 0]]]
							} else {
								return ['.unit']
							}
						}()), // Bind arguments list
						['.declare', t],
						['=', t, ['.unit']], // Clear return value
						aux.hasReturn ? ['.label', l, ['.seq', 
							body,
							['=', t, ['.unit']]
						]] : ['.seq', 
							body,
							['=', t, ['.unit']]
						],
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
		var r = expandIIFE(node, false);
		return r;
	}
}