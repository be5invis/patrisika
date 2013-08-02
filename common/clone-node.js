var cloneNode = function(node){
	if(node instanceof Array){
		var duplicate = node.slice(0).map(cloneNode);
		if(node.sourcePosition) duplicate.sourcePosition = node.sourcePosition;
		return duplicate
	} else {
		return node;
	}
}

exports.cloneNode = cloneNode;