/// WARNING! THIS PASS IS BLACK MAGIC. IT IS EXORDINARY DANGEROUS AND MAY
/// POTENTIALLY DAMAGE YOUR MIND. DO NOT TOUCH UNLESS YOU KNOW EXACTLY HOW IT 
/// WORKS.

/// Pass CPS transform.
/// abbr. cps
/// In this pass, we will convert functions containing '.bind' operator
/// into a CPS transformed form.

var Rules = require('../common/pass').Rules;
var Rules_ = require('../common/pass').Rules_;
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

	var FnGenerated = function(node) {
		node.isGenerated = true;
		return node;
	}

	var generateFnCPSNeed = Rules(
		[['.fn', '...'], function(node, fn){ generateFnCPSNeed(node[2], node) }],
		[['.wait', '...'], function(node, fn){ recurse(node, generateFnCPSNeed, fn); fn.containsWait = true }]
	);

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
					return node.containsWait = needs					
				}
				case '.break' : {
					return node.containsWait = true;
				}
				case '.wait' : {
					for(var j = 1; j < node.length; j++) {
						generateCPSNeed(node[j]);
					}
					return node.containsWait = true
				}
				default: {
					var needs = false;
					for(var j = 1; j < node.length; j++) {
						needs = generateCPSNeed(node[j]) || needs;
					}
					return node.containsWait = needs
				}
			}
		} else if(node instanceof Array) {
			var needs = false;
			for(var j = 0; j < node.length; j++) {
				needs = generateCPSNeed(node[j]) || needs;
			}
			return node.containsWait = needs
		} else {
			return false;
		}
	}
	var Continuation = function(t, body) {
		var node = ['.fn', ['.list', t], body]
		node.isGenerated = true;
		node.isContinuation = true;
		return node;
	}
	var ContinuationResend = function(c) {
		var t = mt();
		var node = ['.fn', ['.list', t], ['.return', [c, t]]]
		node.isGenerated = true;
		node.isContinuation = true;
		return node;
	}
	var generateCPSForFn = function(fn) {
		var cpsBind = function(node, continuation) {
//			return [continuation, node];
			if(continuation[0] === '.fn' && continuation.isContinuation &&
				continuation[1] && continuation[1].length === 2 && continuation[1][0] === '.list') {
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

		var cps1 = Rules_(
			['#leaf', function(node, continuation){ return cpsBind(node, continuation) }],
			['#call', function(node, continuation){ return cpsStandard(node, continuation, 0, true) }],
			['#op', function(node, continuation){ return cpsStandard(node, continuation, 1, false) }],
			[['=', '...'], function(node, continuation){ 
				if(typeof node[1] === 'string' || nodeIsOperation(node[1]) && node[1][0] === '.t') {
					var t = mt();
					return cps(node[2], Continuation(t, ['=', node[1], t]))
				} else {
					return cpsStandard(node, continuation, 1, true)
				}
			}],
			[['.wait', '...'], function(node, continuation){
				var t = mt();
				return cps(node[1], Continuation(t, ['.seq', 
					['=', tNext, continuation], 
					['.return', ['.obj', ['value', t], ['done', ['.lit', false]]]]]))
			}],
			[['.if', '...'], function(node, continuation){
				var condition = node[1];
				var thenPart = node[2];
				var elsePart = node[3] || ['.unit'];
				var fCont = mtf();
				var tCond = mt();
				return [FnGenerated(['.fn', ['.list', 'fCont'],
					cps(condition, Continuation(tCond, 
						['.if', tCond, 
							['.return', cps(thenPart, fCont)],
							['.return', cps(elsePart, fCont)]]))
				]), continuation]
			}],
			[['&&', '...'], function(node, continuation) {
				var left = node[1];
				var right = node[2];
				var tl = mt();
				var tr = mt();
				var fCont = mtf();
				return [FnGenerated(['.fn', ['.list', fCont], 
					cps(left, Continuation(tl, ['.if', tl, 
						cps(right, Continuation(tr, cpsBind(['&&', tl, tr], fCont))),
						cpsBind(fCont, tl)
					]))
				]), continuation]
			}],
			[['||', '...'], function(node, continuation) {
				var left = node[1];
				var right = node[2];
				var tl = mt();
				var tr = mt();
				var fCont = mtf();
				return [FnGenerated(['.fn', ['.list', fCont], 
					cps(left, Continuation(tl, ['.if', tl, 
						cpsBind(fCont, tl),
						cps(right, Continuation(tr, cpsBind(['||', tl, tr], fCont)))
					]))
				]), continuation]
			}],
			[['.try', '...'], function(node, continuation) {
				// .try nodes are transformed into a complex form.
				// I hate exceptions.
				var normalPart = node[1];
				var tException = node[2];
				var exceptionPart = node[3];
				var fCont = mtf();
				var bk = mtf();
				return [FnGenerated(['.fn', ['.list', fCont], 
					['.seq',  
						['=', bk, tCatch], // Backup exception handler
						['=', tCatch, FnGenerated(['.fn', ['.list', tException], 
							['.seq', 
								['=', tCatch, bk], // Restore exception handler
								['=', tNext, FnGenerated(['.fn', ['.list'], cps(exceptionPart, fCont)])],
								['.return', [['.', tGen, ['.lit', 'next']]]]
							]
						])],
						['=', tNext, FnGenerated(['.fn', ['.list'], cps(normalPart, fCont)])],
						['.return', [['.', tGen, ['.lit', 'next']]]]
					]
				]), continuation]
			}],
			[['.while', '...'], function(node, continuation) {
				// A .while Node is transformed into a recursive function IIFE.
				var condition = node[1];
				var body = node[2];
				var fCont = mtf();
				var fLoop = mtf();
				var tCond = mt();
				var tB = mt();
				return ['.seq', 
					['.declare', fLoop],
					[['=', fLoop, FnGenerated(['.fn', ['.list', fCont], 
						cps(condition, Continuation(tCond,
							['.if', tCond, 
								cps(body, Continuation(tB, ['.return', [fLoop, fCont]])),
								['.return', [fCont]]
							]
						))
					])], continuation],
				]
			}],
			[['.label', '...'], function(node, continuation) {
				var label = node[1];
				var body = node[2]
				var tBody = mt();
				var fStmt = mtf();
				var fLabel = (typeof label === 'string' ? ['.t', 'cpl' + label] : label)
				return [FnGenerated(['.fn', ['.list', fLabel], 
					cps(body, Continuation(tBody, ['.return', [fLabel, tBody]]))
				]), continuation]
			}],
			[['.break', '...'], function(node, continuation) {
				return ['.return', [(typeof node[1] === 'string' ? ['.t', 'cpl' + node[1]] : node[1])]]
			}],
			[['.return', '...'], function(node, continuation) {
				var t = mt();
				return cps(node[1], Continuation(t, FinishSteps(t)))
			}],
			[['.obj', '...'], function(node, continuation) {
				return cpsObject(node, continuation)
			}],
			[['.seq', '...'], function(node, continuation) {
				if(node.length <= 1) {
					return cps(['.unit'], continuation)
				} else if(node.length <= 2) {
					return cps(node[1], continuation)
				} else {
					return cpsStandard(node, continuation, 1, false)
				}
			}]
		);
		// cps(node, continuation) means that "bring the result of evaluating <node> to <continuation>"
		// continuation is a function node which takes one argument.
		var cps = function(node, continuation) {
			if(node && node.containsWait){
				return cps1(node, continuation)
			} else if(nodeIsOperation(node)) {
				if(node[0] === '.local') {
					return ['.seq', node, continuation[2]]
				} else {
					return cpsBind(cpstfm(node), continuation)
				}
			} else {
				return cpsBind(cpstfm(node), continuation)
			}
		};
		
		var tGen = mt();
		var tNext = mt();
		var tCatch = mt();
		var tX = mt();
		var tE = mt();
		var FinishSteps = function(e){
			return ['.seq', 
				['=', tNext, FnGenerated(['.fn', ['.list'], [['.x', 's0_throw'], ['.lit', 'Already Finished.']]])],
				['=', tCatch, tNext],
				['.return', ['.obj', ['done', ['.lit', true]], ['value', e]]]]
		}
		var contFinish = Continuation(mt(), FinishSteps(['.unit']));
		return ['.fn', fn[1], ['.seq', 
			['=', tNext, FnGenerated(['.fn', ['.list'], cps(fn[2], contFinish)])],
			['=', tCatch, FnGenerated(['.fn', ['.list', tX], [['.x', 's0_throw'], tX]])],
			['=', tGen, ['.obj', 
				['next', FnGenerated(['.fn', ['.list', tX], ['.try', [tNext, tX], tE, ['.seq', [tCatch, tE]]]])],
				['throw', FnGenerated(['.fn', ['.list', tX], [tCatch, tX]])]
			]],
			['.return', tGen]], fn[3]]
	}
	var cpstfm = function(node) {
		if(!node) return node;
		if(nodeIsOperation(node)) {
			if(node[0] === '.fn' && node.containsWait) {
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