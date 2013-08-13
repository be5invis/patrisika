var Hash = require('./hash').Hash

var nodeIsOperation = function(node){
	return (node && node instanceof Array && (typeof node[0] === 'string') && (/^[\.=\-+_~`!@#$%^&*:;"',<>\/?]/.test(node[0])))
}

var STATEMENT_LEVEL = new Hash;
STATEMENT_LEVEL.put('.seq', true)
STATEMENT_LEVEL.put('.if', true)
STATEMENT_LEVEL.put('.while', true)
STATEMENT_LEVEL.put('.return', true)
STATEMENT_LEVEL.put('.try', true)
STATEMENT_LEVEL.put('.local', true)
STATEMENT_LEVEL.put('.break', true)
STATEMENT_LEVEL.put('.label', true)

exports.nodeIsOperation = nodeIsOperation
exports.nodeIsStatemental = function(node){
	return nodeIsOperation(node) && STATEMENT_LEVEL.get(node[0])
}
exports.nodeIsVariable = function(node){
	return node && (typeof node === 'string')
}
exports.nodeIsLiteral = function(node){
	return nodeIsOperation(node) && (node[0] === '.lit' || node[0] === '.fn')
}
exports.STATEMENT_LEVEL = STATEMENT_LEVEL

exports.recurse = function(node, f, aux){
	if(nodeIsOperation(node)) {
		switch(node[0]){
			case '.local' : return;
			case '.break' : return;
			case '.lit' : return;
			case '.declare' : return;
			case '.t' : return;
			case '.obj' : {
				for(var j = 1; j < node.length; j++){
					node[j][1] = f(node[j][1], aux, node)
				}
				return;
			}
			case '.fn' :
			case '.label' : {
				node[2] = f(node[2], aux, node);
				return;
			}
			default : {
				for(var j = 1; j < node.length; j++){
					node[j] = f(node[j], aux, node)
				}
				return;
			}
		}
	} else if(node instanceof Array) {
		for(var j = 0; j < node.length; j++){
			node[j] = f(node[j], aux, node)
		}
	}
}