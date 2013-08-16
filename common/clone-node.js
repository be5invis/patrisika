var cloneNode = function(node){
	if(node instanceof Array){
		var duplicate = node.slice(0);
		for(var j = 0; j < duplicate.length; j++) duplicate[j] = cloneNode(node[j])
		if(node.loc) duplicate.loc = node.loc;
		return duplicate
	} else {
		return node;
	}
}

exports.cloneNode = cloneNode;