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
var xi = require('./passes/expand-iife');
var rn = require('./passes/regular-nest');
var ds = require('./passes/denest-seq');
var rts = require('./passes/resolve-t-scoping');
var codegen = require('./passes/codegen');

var DefaultConfig = function(){
	var config = {}
	config.globalScope = new Scope();
	config.createError = Warning(null);
	config.enableIIFEExpand = true;
	config.enableIIFEExpandExecuteOnce = false;
	return config;
}
exports.transform = function(ast, config) {
	var config = config || DefaultConfig();
	var flowGeneratingPTAst = passOrd.composite([xa, xtc, xfl, xol, cb, xti, cps, rvs, ceqc, xi, ds, rn, rts, ds], config);
	var flowTransformation = passOrd.composite([codegen], config);
	var ptAst = [flowGeneratingPTAst(['.fn', ['.list'], ast])];
	var smAst = flowTransformation(ptAst);
	smAst = {type: 'Program', body: [
		{
			type: 'ExpressionStatement',
			expression: {
				type: 'Literal',
				value: "use strict"
			}
		},
		{
			type: 'ExpressionStatement',
			expression: smAst
		}
	]}
	return {
		patrisikaAst: ptAst,
		spidermonkeyAst: smAst
	}
}