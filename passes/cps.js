/// Pass CPS transform.
/// abbr. cps
/// In this pass, we will convert functions containing '.bind' operator
/// into a CPS transformed form

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
				fn.needsCPS = node.needsCPS = node[1].needsCPS;
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
	var generateCPSForFn = function(fn) {
		var assignCont = function(node, continuation) {
			return ['.seq', ['.declare', continuation[1][1]], ['=', continuation[1][1], node], continuation[2]]
		}
		var cpsStandard = function(node, continuation, jStart, checkFirstIsMemberNode){
			var c = assignCont(node, continuation);
			for(var j = node.length - 1; j >= jStart; j--) {
				if(j === jStart && checkFirstIsMemberNode && nodeIsOperation(node[j]) && node[j][0] === '.') {
					var t = mt();
					c = cps(node[j][2], ['.fn', ['.list', t], c])
					node[j][2] = t;
					var t = mt();
					c = cps(node[j][1], ['.fn', ['.list', t], c])
					node[j][1] = t;
				} else {
					var t = mt();
					c = cps(node[j], ['.fn', ['.list', t], c])
					node[j] = t;
				}
			}
			return c;
		}
		var cpsObject = function(node, continuation){
			var c = assignCont(node, continuation);
			for(var j = node.length - 1; j >= 1; j--) {
				var t = mt();
				c = cps(node[j][1], ['.fn', ['.list', t], c])
				node[j][1] = t;
			}
			return c;
		}
		var cps = function(node, continuation) {
			if(nodeIsOperation(node)) {
				if(node.needsCPS) {
					switch(node[0]) {
						case '.lit' :
						case '.t' :
						case '.unit' : {
							return assignCont(node, continuation)
						}
						case '=' : {
							if(typeof node[1] === 'string') {
								var t = mt();
								return cps(node[2], ['.fn', ['.list', t], ['=', node[1], t]])
							} else {
								return cpsStandard(node, continuation, 1, true)
							}
						}
						case '.wait' : {
							var t = mt();
							return cps(node[1], ['.fn', ['.list', t], [['.', tSchema, ['.lit', 'bind']], t, continuation]])
						}
						case '.if' : {
							var condition = node[1];
							var thenPart = node[2];
							var elsePart = node[3] || ['.unit'];
							var fCont = mtf();
							var fBranch = mtf();
							var tCond = mt();
							var tTP = mt();
							var tEP = mt();
							return ['.seq', 
								['.declare', fCont],
								['.declare', fBranch],
								['=', fBranch, ['.fn', ['.list'], cps(condition, ['.fn', ['.list', tCond],
									['.if', tCond, 
										cps(thenPart, ['.fn', ['.list', tTP], ['.return', [fCont, tTP]]]),
										cps(elsePart, ['.fn', ['.list', tEP], ['.return', [fCont, tEP]]])]
								])]],
								['=', fCont, continuation],
								['.return', [fBranch]]
							]
						}
						case '.try' : {
							var normalPart = node[1];
							var exceptionName = node[2];
							var exceptionPart = node[3];
							var fCont = mtf();
							var fTry = mtf();
							var fCatch = mtf();
							var tTry = mt();
							var tCatch = mt();
							return ['.seq', 
								['.declare', fTry],
								['.declare', fCatch],
								['=', fTry, ['.fn', ['.list', tSchema], cps(normalPart, ['.fn', ['.list', tTry],
									['.return', [fCont, tTry]]
								])]],
								['=', fCatch, ['.fn', ['.list', tSchema, exceptionName], cps(exceptionPart, ['.fn', ['.list', tCatch],
									['.return', [fCont, tCatch]]
								])]],
								['=', fCont, continuation],
								['.return', [['.', tSchema, ['.lit', 'try']], fTry, fCatch]]
							]
						}
						case '.while' : {
							var condition = node[1];
							var body = node[2];
							var fCont = mtf();
							var fLoop = mtf();
							var tCond = mt();
							var tB = mt();
							return ['.seq', 
								['.declare', fCont],
								['.declare', fLoop],
								['=', fLoop, ['.fn', ['.list'], 
									cps(condition, ['.fn', ['.list', tCond],
										['.if', tCond, 
											cps(body, ['.fn', ['.list', tB], [fLoop]]),
											['.return', [fCont]]]
									])
								]],
								['=', fCont, continuation],
								['.return', [fLoop]]
							]
						}
						case '.label' : {
							var label = node[1];
							var body = node[2]
							var tBody = mt();
							var fStmt = mtf();
							return ['.seq', 
								['.declare', fStmt],
								['.declare', ['.t', label]],
								['=', fStmt, ['.fn', ['.list'], 
									cps(body, ['.fn', ['.list', tBody], 
										['.return', [['.t', label], tBody]]
									])
								]],
								['=', ['.t', label], continuation],
								['.return', [fStmt]]
							]
						}
						case '.break' : {
							return ['.return', [['.t', node[1]]]]
						}
						case '.doblock' : {
							return [['.', tSchema, ['.lit', 'doblock']], cpstfm(node[1]), continuation]
						}
						case '.return' : {
							var t = mt();
							return cps(node[1], ['.fn', ['.list', t], 
								['.return', [['.', tSchema, ['.lit', 'return']], t]]
							])
						}
						case '.obj' : {
							return cpsObject(node, continuation)
						}
						default : {
							return cpsStandard(node, continuation, 1, false)
						}
					}
				} else {
					if(node[0] === '.local') {
						return ['.seq', node, continuation[2]]
					} else {
						return assignCont(cpstfm(node), continuation)
					}
				}
			} else if(node instanceof Array && node.needsCPS) {
				return cpsStandard(node, continuation, 0, true)
			} else {
				return assignCont(cpstfm(node), continuation)
			}
		};
		
		var tSchema = mts();
		var contFinish = ['.fn', ['.list', mt()], [
			['.', tSchema, ['.lit', 'return']]
		]];
		return ['.fn', ['.list', tSchema], ['.return', ['.fn', fn[1], cps(fn[2], contFinish)]]]
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