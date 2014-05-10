/// Pass IIFE Expansion

var recurse = require('../common/node-types.js').recurse
var nodeIsOperation = require('../common/node-types').nodeIsOperation
var util = require('util')
var Symbol = require('../common/scope').Symbol
var Rules = require('../common/pass').Rules;

exports.Pass = function(config) {
	var mt = require('../common/tempname').TMaker('xit');
	var mta = require('../common/tempname').TMaker('xia');
	var ml = require('../common/tempname').TMaker('xil');

	var transformIIFEBody = Rules(
		[['.fn', '...'], function(node){ return node }],
		[['.return', '...'], function(node, aux){ 
			aux.hasReturn = true; 
			return ['.seq', 
				['=', aux.tid, transformIIFEBody(node[1], aux, node)],
				['.break', aux.lid]
			]}],
		[['.args', '...'], function(node, aux){ aux.hasArgs = true; return [['.', aux.aid, 'slice'], ['.lit', 0]] }],
		[['.this', '...'], function(){ return ['.lit', null] }]
	)

	var expandIIFE = Rules(
		[[['.fn', ['.list', '...'], '...'], '...'], function(node, ex1){ 
			recurse(node, expandIIFE, ex1);
			if(config.enableIIFEExpand) {
				var fn = node[0];

				/// There are two situations which an IIFE could be expanded safely:
				/// A. An IIFE which its callee does not have nested scopes.
				/// B. An IIFE with NO parameters and NO local variables.
				/// C. (EXPERIMENTAL) An IIFE which is only executed once.

				if(fn.scope 
					&& (config.enableIIFEExpandExecuteOnce && ex1 
						|| !fn.scope.children.length 
						|| ((!fn[3] || !fn[3].length) && fn[1].length === 1 && node.length === 1))) {
					///IIFE expansion
					var t = mt();   // T for return value
					var l = ml();   // T for label
					var ta = mta(); // T for argument list
					var aux = {tid: t, lid: l, aid: ta}
					var body = transformIIFEBody(fn[2], aux, fn);
					var locals = fn[3];
					var parameters = fn[1].slice(1);
					var args = node.slice(1);
					var result = ['.seq',
						// Declaration for function parameters
						(function(){
							var s = ['.seq', ['.unit']]
							var l = ['.local']
							for(var j = 0; j < parameters.length; j++) {
								if(parameters[j] instanceof Symbol) l.push(parameters[j])
								else s.push(['.declare', parameters[j]]);
							}
							if(l.length > 1) s.push(l);
							return s;
						}()), 
						// Declaration for parameter list
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
						}()), 
						// Bind arguments list
						['.declare', t],
						// Clear return value
						['=', t, ['.unit']], 
						// transform [.local] part for fn
						(function(){
							if(locals){
								return ['.seq', locals, locals.slice(1).reduceRight(function(existing, name){
									return ['=', name, existing]
								}, ['.unit'])]
							} else {
								return ['.unit']
							}
						}()),
						// The fn body
						aux.hasReturn ? ['.label', l, ['.seq', 
							body,
							['=', t, ['.unit']]
						]] : ['.seq', 
							body,
							['=', t, ['.unit']]
						],
						// Return value of this IIFE
						t
					];
					if(fn.scope.parent && fn.scope.parent.children) {
						var a = []
						for(var j = 0; j < fn.scope.parent.children.length; j++)
							if(fn.scope.parent.children[j] !== fn.scope)
								a.push(fn.scope.parent.children[j])
						fn.scope.parent.children = a;
					};
					return result;
				}
			}
		}],
		[['.fn', '...'], function(node){ node[2] = expandIIFE(node[2], true) }],
		[['.while', '...'], function(node){ recurse(node, expandIIFE, false) }]
	)

	return function(node){
		var r = expandIIFE(node, false);
		return r;
	}
}