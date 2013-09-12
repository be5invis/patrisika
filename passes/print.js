exports.Pass = function(co) {
	return function(node) {
		console.log(require('util').inspect(node, {depth: null, colors: true}))
		return node;
	}
}