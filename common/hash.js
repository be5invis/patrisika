var OWNS = function() {
	var hop = {}.hasOwnProperty;
	return function(o,p) {
		return hop.call(o,p)
	}
}();
var Hash = function() {};
(function() {
	var MANGLE = '.';
	var MANGLELENGTH = MANGLE.length;
	Hash.prototype = {};
	Object.defineProperty(Hash.prototype, 'put', {
		value: function(key, val){
			return this[MANGLE + key] = val
		},
		enumerable: false
	});
	Object.defineProperty(Hash.prototype, 'get', {
		value: function(key) {
			return this[MANGLE + key]
		},
		enumerable: false
	});
	Object.defineProperty(Hash.prototype, 'has', {
		value: function(key) {
			return OWNS(this, MANGLE + key)
		},
		enumerable: false
	});
	Object.defineProperty(Hash.prototype, 'forEach', {
		value: function(f) {
			for(var _key in this) {
				if(OWNS(this, _key)) {
					f(_key.slice(MANGLELENGTH), this[_key]);
				}
			}
		},
		enumerable: false
	});
})();

exports.Hash = Hash;