var syntax_rule = require('../commons/match.js').syntax_rule;
var _ = require('../commons/match.js')._;
var atom = require('../commons/match.js').atom;
var empty = require('../commons/match.js').empty;
var any = require('../commons/match.js').any;
var prim = require('../commons/match.js').prim;

var Scope = require('../commons/scope.js').Scope;

var scoping = syntax_rule(
	[['.lambda', ',args', ',body'], function(form, env){
		var derived = new Scope(env);
		var args = [];
		for(var j = 0; j < this.args.length; j++){
			derived.declare(this.args[j], true)
			args[j] = derived.use(this.args[j]);
		}
		return ['.lambda', args, scoping(this.body, derived), derived]
	}],
	[['.beta', ',args', ',body', ',..params'], function(form, env){
		var derived = new Scope(env);
		var args = [], params = [];
		for(var j = 0; j < this.args.length; j++){
			derived.declare(this.args[j], true)
			args[j] = derived.use(this.args[j]);
		};
		for(var j = 0; j < this.params.length; j++){
			params[j] = scoping(this.params[j], env)
		}
		return ['.beta', args, scoping(this.body, derived), derived].concat(params)
	}],
	[['.try', ',block', [_('param', atom)], ',handler'], function(form, env){
		env.declare(this.param);
		return ['.try', scoping(this.block, env), env.use(this.param), scoping(this.handler, env)]
	}],
	[['.hash', ',..args'], function(form, env){
		var a = ['.hash'];
		for(var j = 1; j < form.length; j++){
			a[j] = [form[j][0], scoping(form[j][1], env)];
		};
		return a;
	}],
	[[',..call'], function(form, env){
		var j0 = prim(form[0]) ? 1 : 0;
		var a = form.slice(0);
		for(var j = j0; j < form.length; j++){
			a[j] = scoping(form[j], env)
		}
		return a;
	}],
	[atom, function(form, env){ 
		if(/^\W/.test(form)) return form
		else return env.use(form)
	}],
	[any, function(form){ return form }]
)

exports.pass = function(form, globalScope){
	return scoping(form, globalScope);
}