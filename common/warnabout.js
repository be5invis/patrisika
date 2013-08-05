var util = require('util');
var Warning = function(source){
	///
	return function(reason, node){
		var report = reason;
		if(node){
			report += "\nIn node " + util.inspect(node)
			if(node.loc) {
				report += "\nIn source ..."
			}
		}
		return new Error(report);
	}
}
exports.Warning = Warning;