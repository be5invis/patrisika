var passOrd = require('./common/pass');
var Warning = require('./common/warnabout').Warning;
var Scope = require('./common/scope').Scope;

var xa = require('./passes/expand-assignment');
var xtc = require('./passes/expand-try-catch');
var xfl = require('./passes/expand-fn-literal');
var xti = require('./passes/expand-this');
var rvs = require('./passes/resolve-variable-scoping');
var cb = require('./passes/check-break');
var ceqc = require('./passes/convert-eqc');
var xol = require('./passes/expand-object-literal');
var cps = require('./passes/cps');
var flex = require('./passes/flex-scopes');
var xi = require('./passes/expand-iife');
var rn = require('./passes/regular-nest');
var ds = require('./passes/denest-seq');
var rts = require('./passes/resolve-t-scoping');
var codegen = require('./passes/codegen');
var print = require('./passes/print');

var DefaultGlobalScope = function() {
	var s = new Scope();
	s.declare('Object', false, false, ['.x', 'Object']);
	s.declare('Function', false, false, ['.x', 'Function']);
	s.declare('String', false, false, ['.x', 'String']);
	s.declare('Number', false, false, ['.x', 'Number']);
	s.declare('Boolean', false, false, ['.x', 'Boolean']);
	s.declare('Date', false, false, ['.x', 'Date']);
	s.declare('RegExp', false, false, ['.x', 'RegExp']);
	s.declare('Error', false, false, ['.x', 'Error']);
	s.declare('undefined', false, false, ['.unit']);
	return s;
}

var DefaultConfig = function(gs){
	var config = {}
	config.globalScope = gs || DefaultGlobalScope();
	config.createError = Warning(null);
	config.enableIIFEExpand = true;
	config.enableIIFEExpandExecuteOnce = false;
	return config;
}
exports.Config = DefaultConfig;
var USE_STRICT_NODE = {
	type: 'ExpressionStatement',
	expression: {
		type: 'Literal',
		value: "use strict"
	}
};
exports.transform = function(ast, config) {
	var config = config || DefaultConfig();
	var flowGeneratingPTAst = passOrd.composite([xa, xtc, xfl, xol, xti, cb, rvs, ceqc, cps, flex, xi, rn, rts, ds], config);
	var flowTransformation = passOrd.composite([codegen], config);
	var ptAst = [flowGeneratingPTAst(['.fn', ['.list'], ast])];
	var smAst = flowTransformation(ptAst);
	if(config.piece && smAst.expression.callee && smAst.expression.callee.type === 'FunctionExpression') {
		smAst = smAst.expression.callee.body;
		smAst.body.unshift(USE_STRICT_NODE);
		smAst = {type: 'Program', body: smAst.body}
	} else {
		smAst = {type: 'Program', body: [USE_STRICT_NODE, smAst]}
	}

	return {
		patrisikaAst: ptAst,
		spidermonkeyAst: smAst
	}
}