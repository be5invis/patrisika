var util = require('util');
var Warning = function(source){
	///
	return function(reason, node){
		var report = reason;
		for(var j = 1; j < arguments.length; j++) {
			var node = arguments[j];
			report += "\nIn node " + util.inspect(node)
			if(node.loc) {
				report += "\nIn source ..."
			}
		}
		return new Error(report);
	}
}
exports.Warning = Warning;