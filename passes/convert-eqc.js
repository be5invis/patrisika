/// Pass Convert [=c]
/// abbr. ceqc
/// In this pass we convert [=c] into common [=]s

var APassFor = require('../common/pass').APassFor
var recurse = require('../common/node-types.js').recurse;
var nodeIsOperation = require('../common/node-types').nodeIsOperation;
var nodeIsVariable = require('../common/node-types').nodeIsVariable;

exports.Pass = APassFor(
	['=c', function(node){ return ['='].concat(node.slice(1)) }]
)