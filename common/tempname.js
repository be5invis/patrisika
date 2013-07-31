var TMaker = function(family){
	var n = 0;
	if(!family) family = '';
	return function(){
		return ['.t', family + (n++)]
	}
}

exports.TMaker = TMaker

var encodeCommonNames = function(id){
	return id.replace(/^_+/, '$&$&')
}
var encodeTNames = function(id){
	return '_' + id.replace(/^_+/, '$&$&')
}
exports.encodeCommonNames = encodeCommonNames
exports.encodeTNames = encodeTNames