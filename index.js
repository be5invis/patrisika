var util = require('util');
var Scope = require('patrisika-scopes').Scope;
var escapeId = require('patrisika-scopes').escapeId;
var deo = require('./passes/cps-deo').pass;
var cdg = require('./passes/codegen').pass;

exports.regularize = deo;
exports.pat2esc = cdg;
exports.generate = function(ast, globals){
	var r = deo(ast, globals);
	return cdg(r, globals)
}
exports.DefaultExterns = function(){
	var externs = new Scope();
	externs.castName = escapeId;

	externs.declare('Object')
	externs.declare('Number')
	externs.declare('Boolean')
	externs.declare('String')
	externs.declare('RegExp')
	externs.declare('Function')
	externs.declare('Error')
	externs.declare('Date')
	externs.declare('Array')
	externs.declare('Math')
	externs.declare('Buffer')
	externs.declare('alert')
	externs.declare('console')
	externs.declare('setInterval')
	externs.declare('setTimeout')
	externs.declare('JSON')

	return externs;
};

exports.Scope = Scope;