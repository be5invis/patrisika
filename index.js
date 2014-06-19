var util = require('util');
var Scope = require('./passes/commons/scope').Scope;
var deo = require('./passes/latter/cps-deo').pass;
var cdg = require('./passes/latter/codegen').pass;

exports.generate = function(ast, externs){
	//var globals = new Scope(externs);
	var r = deo(ast, externs);
	return cdg(r)
}
exports.defaultExterns = function(externs){
	externs.castName = function(name){ return name };
	var operatorRename = function(op){
		return function(ex, form, env){
			return ex([op].concat(form.slice(1)), env)
		}
	}
	externs.macros.put('lambda', operatorRename('.lambda'));
	externs.macros.put('begin', operatorRename('.begin'));
	externs.macros.put('if', operatorRename('.if'));
	externs.macros.put('while', operatorRename('.while'));
	externs.macros.put('try', operatorRename('.try'));
	externs.macros.put('let', function(ex, form, env){
		var pairs = form.slice(1, -1);
		var args = pairs.map(function(pair){ return pair[0] })
		var paras = pairs.map(function(pair){ return pair[1] })
		return ex(['.beta', args, form[form.length - 1]].concat(paras), env)
	});

	externs.declare('Object')
	externs.declare('Number')
	externs.declare('Boolean')
	externs.declare('String')
	externs.declare('RegExp')
	externs.declare('Function')
	externs.declare('alert')

	return externs;
}(new Scope());