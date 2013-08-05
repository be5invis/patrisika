var cloneNode = function(node){
	if(node instanceof Array){
		var duplicate = node.slice(0).map(cloneNode);
		if(node.loc) duplicate.loc = node.loc;
		return duplicate
	} else {
		return node;
	}
}

exports.cloneNode = cloneNode;