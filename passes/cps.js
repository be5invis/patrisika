/// WARNING! THIS PASS IS BLACK MAGIC. IT IS EXORDINARY DANGEROUS AND MAY
/// POTENTIALLY DAMAGE YOUR MIND. DO NOT TOUCH UNLESS YOU KNOW EXACTLY HOW IT 
/// WORKS.

/// Pass CPS transform.
/// abbr. cps
/// In this pass, we will convert functions containing '.bind' operator
/// into a CPS transformed form.

var Hash = require('../common/hash').Hash
var nodeIsStatemental = require('../common/node-types').nodeIsStatemental
var nodeIsLiteral = require('../common/node-types').nodeIsLiteral
var nodeIsOperation = require('../common/node-types').nodeIsOperation
var cloneNode = require('../common/clone-node').cloneNode
var recurse = require('../common/node-types.js').recurse

exports.Pass = function(config) {
	var mt = require('../common/tempname').TMaker('cp');
	var mts = require('../common/tempname').TMaker('scm');
	var mtf = require('../common/tempname').TMaker('cpf');
	var generateFnCPSNeed = function(node, fn) {
		if(!node) return node;
		if(nodeIsOperation(node)) {
			if(node[0] === '.fn') {
				// This is a generator!
				generateFnCPSNeed(node[2], node);
			} else if(node[0] === '.wait') {
				recurse(node, generateFnCPSNeed, fn);
				fn.needsCPS = true;
			} else if(node[0] === '.doblock') {
				recurse(node, generateFnCPSNeed, fn);
				fn.needsCPS = fn.needsCPS || (node.needsCPS = node[1].needsCPS);
			} else {
				recurse(node, generateFnCPSNeed, fn);
			}
		} else if(node instanceof Array) {
			recurse(node, generateFnCPSNeed, fn);
		}
		return node;
	}
	var generateCPSNeed = function(node) {
		if(nodeIsOperation(node)) {
			switch(node[0]) {
				case '.local' : return;
				//case '.break' : return;
				case '.lit' : return;
				case '.declare' : return;
				case '.t' : return;
				case '.fn' : {
					// Functions are special. Their "cps needless" status will hardly reaches
					// outside, but stored.
					return false
				}
				case '.obj' : {
					var needs = false;
					for(var j = 1; j < node.length; j++) {
						needs = generateCPSNeed(node[j][1]) || needs;
					}
					return node.needsCPS = needs					
				}
				case '.doblock' : {
					return node.needsCPS
				}
				case '.break' : {
					return node.needsCPS = true;
				}
				case '.wait' : {
					for(var j = 1; j < node.length; j++) {
						generateCPSNeed(node[j]);
					}
					return node.needsCPS = true
				}
				default: {
					var needs = false;
					for(var j = 1; j < node.length; j++) {
						needs = generateCPSNeed(node[j]) || needs;
					}
					return node.needsCPS = needs
				}
			}
		} else if(node instanceof Array) {
			var needs = false;
			for(var j = 0; j < node.length; j++) {
				needs = generateCPSNeed(node[j]) || needs;
			}
			return node.needsCPS = needs
		} else {
			return false;
		}
	}
	var Continuation = function(t, body) {
		return ['.fn', ['.list', t], body, true]
	}
	var ContinuationResend = function(c) {
		var t = mt();
		return ['.fn', ['.list', t], ['.return', [c, t]], true]
	}
	var generateCPSForFn = function(fn) {
		var cpsBind = function(node, continuation) {
//			return [continuation, node];
			if(continuation[0] === '.fn' && continuation[1] && continuation[1].length === 2 && continuation[1][0] === '.list') {
				return ['.seq', ['.declare', continuation[1][1]], ['=', continuation[1][1], node], continuation[2]]
			} else {
				return [continuation, node]
			}
		}
		var cpsStandard = function(node, continuation, jStart, checkFirstIsMemberNode){
			var nodeClone = node.slice(0);
			var c = cpsBind(nodeClone, continuation);
			for(var j = node.length - 1; j >= jStart; j--) {
				if(j === jStart && checkFirstIsMemberNode && nodeIsOperation(node[j]) && node[j][0] === '.') {
					var t2 = mt();
					c = cps(node[j][2], Continuation(t2, c))
					var t1 = mt();
					c = cps(node[j][1], Continuation(t1, c))
					nodeClone[j] = ['.', t1, t2]
				} else {
					var t = mt();
					c = cps(node[j], Continuation(t, c))
					nodeClone[j] = t;
				}
			}
			return c;
		}
		var cpsObject = function(node, continuation){
			var c = cpsBind(node, continuation);
			for(var j = node.length - 1; j >= 1; j--) {
				var t = mt();
				c = cps(node[j][1], Continuation(t, c))
				node[j][1] = t;
			}
			return c;
		}
		// cps(node, continuation) means that "bring the result of evaluating <node> to <continuation>"
		// continuation is a function node which takes one argument.
		var cps = function(node, continuation) {
			if(nodeIsOperation(node) && node.needsCPS) {
				switch(node[0]) {
					case '.lit' :
					case '.t' :
					case '.this' :
					case '.unit' : {
						return cpsBind(node, continuation)
					}
					case '=' : {
						if(typeof node[1] === 'string' || nodeIsOperation(node[1]) && node[1][0] === '.t') {
							var t = mt();
							return cps(node[2], Continuation(t, ['=', node[1], t]))
						} else {
							return cpsStandard(node, continuation, 1, true)
						}
					}
					case '.wait' : {
						var t = mt();
						return cps(node[1], Continuation(t, [['.', tSchema, ['.lit', 'bind']], t, continuation]))
					}
					case '.if' : {
						var condition = node[1];
						var thenPart = node[2];
						var elsePart = node[3] || ['.unit'];
						var fCont = mtf();
						var tCond = mt();
						return [['.fn', ['.list', fCont], 
							cps(condition, ['.fn', ['.list', tCond],
								['.if', tCond, 
									['.return', cps(thenPart, fCont)],
									['.return', cps(elsePart, fCont)]],
								true
							]),
							true
						], continuation]
					}
					case '&&' : {
						var left = node[1];
						var right = node[2];
						var tl = mt();
						var tr = mt();
						var fCont = mtf();
						return ['.seq', 
							[['.fn', ['.list', fCont], cps(left, ['.fn', ['.list', tl], 
								['.if', tl, 
									cps(right, ['.fn', ['.list', tr], [fCont, ['&&', tl, tr]], true]), 
									[fCont, tl]
								],
								true
							]), true], continuation]
						]
					}
					case '||' : {
						var left = node[1];
						var right = node[2];
						var tl = mt();
						var tr = mt();
						var fCont = mtf();
						return ['.seq', 
							[['.fn', ['.list', fCont], cps(left, ['.fn', ['.list', tl], 
								['.if', tl, 
									[fCont, tl],
									cps(right, ['.fn', ['.list', tr], [fCont, ['||', tl, tr]], true])
								],
								true
							]), true], continuation]
						]
					}
					case '.try' : {
						// .try nodes are transformed into schema method call passing 2 arguments: fTry and fCatch
						// representing the try block and the catch block respectively.
						var normalPart = node[1];
						var tException = node[2];
						var exceptionPart = node[3];
						var fCont = mtf();
						return ['.seq', 
							[['.fn', ['.list', fCont], 
								[['.', tSchema, ['.lit', 'try']],  
									['.fn', ['.list', tSchema], 
										cps(normalPart, fCont), true], 
									['.fn', ['.list', tSchema, tException], 
										cps(exceptionPart, fCont), true]
								],
								true
							], continuation],
						]
					}
					case '.while' : {
						// A .while Node is transformed into a recursive function IIFE.
						var condition = node[1];
						var body = node[2];
						var fCont = mtf();
						var fLoop = mtf();
						var tCond = mt();
						var tB = mt();
						return ['.seq', 
							['.declare', fLoop],
							[['=', fLoop, ['.fn', ['.list', fCont], 
								cps(condition, ['.fn', ['.list', tCond],
									['.if', tCond, 
										cps(body, ['.fn', ['.list', tB], ['.return', [fLoop, fCont]], true]),
										['.return', [fCont]]],
									true
								]),
								true
							]], continuation],
						]
					}
					case '.label' : {
						var label = node[1];
						var body = node[2]
						var tBody = mt();
						var fStmt = mtf();
						var fLabel = (typeof label === 'string' ? ['.t', 'cpl' + label] : label)
						return [['.fn', ['.list', fLabel], 
							cps(body, Continuation(tBody, ['.return', [fLabel, tBody]])), true
						], continuation]
					}
					case '.break' : {
						return ['.return', [(typeof node[1] === 'string' ? ['.t', 'cpl' + node[1]] : node[1])]]
					}
					case '.doblock' : {
						return [['.', tSchema, ['.lit', 'doblock']], cpstfm(node[1]), continuation]
					}
					case '.return' : {
						var t = mt();
						return cps(node[1], Continuation(t, ['.return', [['.', tSchema, ['.lit', 'return']], t]]))
					}
					case '.obj' : {
						return cpsObject(node, continuation)
					}
					case '.seq' : {
						if(node.length <= 1) {
							return cps(['.unit'], continuation)
						} else if(node.length <= 2) {
							return cps(node[1], continuation)
						} else {
							return cpsStandard(node, continuation, 1, false)
						}
					}
					default : {
						return cpsStandard(node, continuation, 1, false)
					}
				}
			} else if(nodeIsOperation(node)) {
				if(node[0] === '.local') {
					return ['.seq', node, continuation[2]]
				} else {
					return cpsBind(cpstfm(node), continuation)
				}
			} else if(node instanceof Array && node.needsCPS) {
				return cpsStandard(node, continuation, 0, true)
			} else {
				return cpsBind(cpstfm(node), continuation)
			}
		};
		
		var tSchema = mts();
		var contFinish =  Continuation(mt(), [['.', tSchema, ['.lit', 'return']]]);
		return ['.obj', ['build', ['.fn', ['.list', tSchema], ['.return', ['.fn', fn[1], cps(fn[2], contFinish)]]]]]
	}
	var cpstfm = function(node) {
		if(!node) return node;
		if(nodeIsOperation(node)) {
			if(node[0] === '.fn' && node.needsCPS) {
				// This is a generator!
				generateCPSNeed(node[2]);
				return generateCPSForFn(node);
			} else {
				recurse(node, cpstfm);
				return node;
			}
		} else if(node instanceof Array) {
			recurse(node, cpstfm);
			return node;
		} else {
			return node;
		}
	}
	return function(node){
		generateFnCPSNeed(node);
		return cpstfm(node);
	}
}