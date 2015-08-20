function FormInvalidError(form, reason){
	this.reason = reason;
	this.message = reason;
	this.relatedForm = form;
	if(form && form.within) this.within = form.within;
	if(form && form.begins >= 0 && form.ends >= 0){
		this.begins = form.begins;
		this.ends = form.ends;
		this.message += '\nAround (' + form.begins + ' -- ' + form.ends + ')' + (this.within && this.within.file ? ' of ' + this.within.file : '')
	}
}
FormInvalidError.prototype = Object.create(Error.prototype);

exports.FormInvalidError = FormInvalidError