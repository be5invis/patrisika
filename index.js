var Scope = require('patrisika-scopes').Scope;
var escapeId = require('patrisika-scopes').escapeId;
var deo = require('./passes/cps-deo').pass;
var cdg = require('./passes/codegen').pass;

exports.FormInvalidError = require('./commons/formerror.js').FormInvalidError;
exports.regularize = deo;
exports.pat2esc = cdg;
exports.generate = function (ast, globals, exitK) {
	var r = deo(ast, globals, exitK);
	return cdg(r, globals)
}
exports.DefaultExterns = function () {
	var externs = new Scope();
	externs.castName = escapeId;

	externs.declare('Object')
	externs.declare('Number')
	externs.declare('Boolean')
	externs.declare('String')
	externs.declare('RegExp')
	externs.declare('Function')
	externs.declare('Error')
	externs.declare('SyntaxError')
	externs.declare('TypeError')
	externs.declare('Date')
	externs.declare('Array')
	externs.declare('Math')
	externs.declare('Buffer')
	externs.declare('Symbol')
	externs.declare('alert')
	externs.declare('console')
	externs.declare('setInterval')
	externs.declare('setTimeout')
	externs.declare('JSON')
	externs.declare('escape')
	externs.declare('unescape')
	externs.declare('encodeURIComponent')
	externs.declare('decodeURIComponent')

	return externs;
};

exports.Scope = Scope;