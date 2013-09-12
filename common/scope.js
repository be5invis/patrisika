var Hash = require('./hash').Hash;
var Symbol = function(scope, name){
	this.scope = scope;
	this.name = name;
}
Symbol.prototype.resolveTo = function(link) {
	Object.defineProperty(this, 'link', {
		value: link,
		enumerable: false
	});
	delete this.scope
}
Symbol.prototype.resolve = function() {
	this.resolveTo(this.scope.uses.get(this.name).link);
}
Symbol.prototype.writeBack = function(){
	return 's' + this.link.inScope.id + '_' + this.link
}
var Declaration = function(name, isParameter, isConstant, xv){
	this.name = name;
	this.isParameter = isParameter;
	this.isConstant = isConstant;
	if(xv) {
		this.externalBind = xv
	}
}
Declaration.prototype.toString = function(){
	return this.name;
}
var Scope = function(parent, isGenerated){
	if(parent){
		this.declarations = Object.create(parent.declarations)
		parent.children.push(this);
		this.parent = parent;
	} else {
		this.declarations = new Hash();
	}
	this.isGenerated = isGenerated;
	this.children = []
	this.uses = new Hash();
}
Scope.prototype.useVariable = function(name, nodeAround) {
	if(this.isGenerated && this.parent) return this.parent.useVariable(name, nodeAround);
	this.uses.put(name, {link: null, loc: nodeAround})
	return new Symbol(this, name)
}
Scope.prototype.declare = function(name, isParameter, isConstant, xv) {
	var decl = new Declaration(name, isParameter, isConstant, xv)
	decl.inScope = this;
	this.declarations.put(name, decl)
}

exports.Symbol = Symbol;
exports.Declaration = Declaration;
exports.Scope = Scope;