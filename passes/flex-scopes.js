var Rules = require('../common/pass').Rules;
var recurse = require('../common/node-types.js').recurse
var nodeIsOperation = require('../common/node-types').nodeIsOperation
var Hash = require('../common/hash').Hash
var Scope = require('../common/scope').Scope

exports.Pass = function(config) {

	var flex = Rules(
		[['.fn', '...'], function(node, aux){
			if(node.scope && node.scope.parent !== aux.lastFigured) {
				throw config.createError('##PATRISIKA -- Scope flexing failed : Topology changed.\nThis is a Patrisika bug, please contact its developers.', node)
			};
			if(node.scope) {
				node.scope.parent = aux.last;
				flex(node[2], {
					last: node.scope,
					lastFigured: node.scope
				})
			} else {
				Object.defineProperty(node, 'scope', {
					value: new Scope(aux.last),
					enumerable: false,
				})
				delete node.scope.declarations
				delete node.scope.uses
				flex(node[2], {
					last: node.scope,
					lastFigured: aux.lastFigured
				})
			}
			return node;
		}]);
	var rebuildChildren = Rules(
		[['.fn', '...'], function(node, parent){
			node.scope.children = [];
			rebuildChildren(node[2], node.scope);
			parent.children.push(node.scope);
		}]);

	return function(node){
		var r = flex(node, {
			last : config.globalScope,
			lastFigured: config.globalScope
		});
		config.globalScope.children = [];
		r = rebuildChildren(r, config.globalScope);
		return r;
	}
}