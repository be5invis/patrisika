function isStatement(form){
	return form instanceof Array && (form[0] === '.if' || form[0] === '.begin' || form[0] === '.return' || form[0] === '.while')
}

exports.isStatement = isStatement;