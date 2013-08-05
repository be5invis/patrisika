var Hash = require('./hash').Hash;
var Symbol = function(scope, name){
	this.scope = scope;
	this.name = name;
}
Symbol.prototype.writeBack = function(){
	return this.scope.uses.get(this.name).link.name
}
var Declaration = function(name, isParameter, isConstant){
	this.name = name;
	this.isParameter = isParameter;
	this.isConstant = isConstant;
}
var Scope = function(parent){
	if(parent){
		this.declarations = Object.create(parent.declarations)
		parent.children.push(this);
	} else {
		this.declarations = new Hash();
	}
	this.children = []
	this.uses = new Hash();
}
Scope.prototype.useVariable = function(name, nodeAround) {
	this.uses.put(name, {link: null, loc: nodeAround})
	return new Symbol(this, name)
}
Scope.prototype.declare = function(name, isParameter, isConstant) {
	this.declarations.put(name, new Declaration(name, isParameter, isConstant))
}

exports.Symbol = Symbol;
exports.Declaration = Declaration;
exports.Scope = Scope;