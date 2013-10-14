/// Pass Resolve Variable Scoping

var recurse = require('../common/node-types.js').recurse
var nodeIsOperation = require('../common/node-types').nodeIsOperation
var Symbol = require('../common/scope').Symbol
var Declaration = require('../common/scope').Declaration
var Scope = require('../common/scope').Scope
var Rules = require('../common/pass').Rules;

exports.Pass = function(config) {
	/// Pass rvs-0: Extract external declarations from AST
	var extractExterns = Rules(
		[['.extern', '.id'], function(node, globalScope){
			globalScope.declare(node[1], 0, 0)
			return ['.unit']
		}]
	)
	/// Pass rvs-1: Extract variable declarations from AST
	/// With constructing scope objects.
	var extractDeclarations = Rules(
		[['.fn', '...'], function(node, scope){
			var subScope = new Scope(scope, !!node.isGenerated);
			for(var j = 1; j < node[1].length; j++) if(typeof node[1][j] === 'string') {
				subScope.declare(node[1][j], true, true)
			}
			extractDeclarations(node[2], subScope);
			Object.defineProperty(node, 'scope', {
				value: subScope, 
				enumerable: false
			});			
		}],
		[['.declare', '.id'], function(node, scope){
			var s = scope;
			while(s.parent && s.isGenerated) s = s.parent;
			if(s.declarations.has(node[1]) && s.declarations.get(node[1]).isConstant) {
				throw config.createError("Attempt to redefine constant " + node[1], node)
			}
			s.declare(node[1], false, false)
			return ['.unit']			
		}],
		[['=c', '.id', '.'], function(node, scope){
			var s = scope;
			while(s.parent && s.isGenerated) s = s.parent;
			if(s.declarations.has(node[1])) {
				throw config.createError("Attempt to redefine constant " + node[1], node)
			} else {
				s.declare(node[1], false, true)
			}
			return ['=c', node[1], extractDeclarations(node[2], scope)]
		}]
	)

	/// Pass rvs-2: Check used variables
	var checkUsages = function(node, scope, parent){
		if(!node) return node;
		if(nodeIsOperation(node)) {
			if(node[0] === '.fn') {
				var subScope = node.scope;
				for(var j = 1; j < node[1].length; j++) if(typeof node[1][j] === 'string') {
					node[1][j] = subScope.useVariable(node[1][j], node[1])
				}
				checkUsages(node[2], subScope, node);
				return node;
			} else if(node[0] === '=' && typeof node[1] === 'string') {
				if(scope.declarations.get(node[1]) && scope.declarations.get(node[1]).isConstant) {
					throw config.createError("Attempt to assign to constant " + node[1], node)
				}
				recurse(node, checkUsages, scope)
				return node
			} else {
				recurse(node, checkUsages, scope)
				return node;
			}
		} else if(node instanceof Array) {
			recurse(node, checkUsages, scope)
			return node;
		} else if(typeof node === 'string') {
			///  node is variable
			return scope.useVariable(node, parent);
		} else {
			return node;
		}
	}
	/// Pass rvs-3: Declare undeclared variables
	var duv = function(scope){
		scope.uses.forEach(function(name, usage) {
			if(scope.declarations.get(name)) {
				/// Link the symbol
				usage.link = scope.declarations.get(name)
			} else if(config.explicit) {
				throw config.createError("Undeclared vairable " + name, usage.loc || null);
			} else {
				var s = scope;
				while(s.parent && s.isGenerated) s = s.parent;
				s.declare(name, false, false)
				usage.link = scope.declarations.get(name)
			}
		});
		for(var j = 0; j < scope.children.length; j++) {
			duv(scope.children[j])
		}
	}
	/// Pass rvs-4: Renaming variables
	var cScopes = 0;
	var renameVariable = function(scope){
		scope.id = cScopes;
		cScopes += 1;
		for(var j = 0; j < scope.children.length; j++) {
			renameVariable(scope.children[j])
		}
	}

	/// Pass rvs-5: Write-back
	var writeBack = Rules(
		[['.fn', '...'], function(node){
			var subScope = node.scope;
			var locals = [];
			subScope.declarations.forEach(function(name, declaration) {
				if(!declaration.isParameter) {
					var localSymbol = new Symbol(subScope, name);
					localSymbol.resolveTo(declaration);
					locals.push(localSymbol)
				}
			});
			writeBack(node[2]);
			if(locals.length) {
				node[3] = ['.local'].concat(locals), node[2]
			} else {
				node[3] = null;
			}
			for(var j = 1; j < node[1].length; j++) if(node[1][j] instanceof Symbol) {
				node[1][j].resolve();
			};
			delete subScope.uses;
//			delete subScope.declarations;
			return node;
		}],
		['.symbol', function(node){
			node.resolve()
		}]
	)
	
	/// Pass rvs-6: Convert [=c]s into [=]s
	var ceqc = Rules(
		[['=c', '.', '.'], function(node){return ['=', ceqc(node[1]), ceqc(node[2])]}]
	)
	return function(node){
		var global = config.globalScope;
		var r = extractExterns(node, global);
		r = extractDeclarations(r, global)
		r = checkUsages(r, global)
		duv(global);
		renameVariable(global);
		r = writeBack(r, global)
		r = ceqc(r);
		return r;
	};
}