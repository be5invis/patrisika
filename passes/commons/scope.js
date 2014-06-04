var Hash = require('./hash').Hash;
var Reference = function(scope, name){
	this.scope = scope;
	this.name = name;
}
Reference.prototype.resolve = function(){
	this.scope.resolve();
	return this.scope.uses.get(this.name).belongs.castName(this.name)
}

var Declaration = function(name, isParameter, belongs){
	this.name = name;
	this.isParameter = isParameter;
	this.belongs = belongs
}
Declaration.prototype.toString = function(){
	return this.name;
}

var N = 0;
var Scope = function(parent){
	if(parent){
		if(parent.declarations) {
			this.declarations = Object.create(parent.declarations)
		} else {
			this.declarations = new Hash();
		}
		Object.defineProperty(this, 'parent', {
			value: parent, 
			enumerable: false
		})
	} else {
		this.declarations = new Hash();
	}
	this.N = (++N);
	this.uses = new Hash();
	this.locals = [];
	this.resolved = false;
}
Scope.prototype.use = function(name) {
	this.uses.put(name, null)
	return new Reference(this, name)
}
Scope.prototype.declare = function(name, isParameter) {
	var decl = new Declaration(name, isParameter, this)
	this.declarations.put(name, decl);
}
Scope.prototype.resolve = function(){
	if(this.resolved) return;
	if(this.parent) this.parent.resolve();
	var t = this;
	t.uses.rewriteOwn(function(id, ref){
		if(!t.declarations.has(id)){
			t.declare(id);
		};
		return t.declarations.get(id);
	});
	t.declarations.forEachOwn(function(id, decl){
		t.locals.push(id);
	});
	t.resolved = true;
}
Scope.prototype.castName = function(name){
	return 's' + this.N + '_' + name;
}
Scope.prototype.inspect = function(){ return "[scope #" + this.N + "]" }

exports.Reference = Reference;
exports.Declaration = Declaration;
exports.Scope = Scope;