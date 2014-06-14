start = OPTIONAL_EXPRESSION_SPACES it:invoke OPTIONAL_EXPRESSION_SPACES {
	return ['.begin'].concat(it)
}
// Expression
factor
	= group
	/ identifier
	/ it:numberliteral { return ['.quote', it] }
	/ it:stringliteral { return ['.quote', it] }

group
	= "[" OPTIONAL_EXPRESSION_SPACES "]" { return [] }
	/ "(" OPTIONAL_EXPRESSION_SPACES ")" { return [] }
	/ "{" OPTIONAL_EXPRESSION_SPACES "}" { return ['.list'] }
	/ "{." OPTIONAL_EXPRESSION_SPACES ".}" { return ['.hash'] }
	/ "[" OPTIONAL_EXPRESSION_SPACES it:invoke OPTIONAL_EXPRESSION_SPACES "]" { return it }
	/ "(" OPTIONAL_EXPRESSION_SPACES it:invoke OPTIONAL_EXPRESSION_SPACES ")" { return it }
	/ "{" OPTIONAL_EXPRESSION_SPACES it:invoke OPTIONAL_EXPRESSION_SPACES "}" { return ['.list'].concat(it) }
	/ "{." OPTIONAL_EXPRESSION_SPACES it:invoke OPTIONAL_EXPRESSION_SPACES ".}" { return ['.hash'].concat(it) }

invoke
	= head:factor rear:(OPTIONAL_EXPRESSION_SPACES factor)* { 
		var res = [head]
		for(var j = 0; j < rear.length; j++){
			res.push(rear[j][1])
		};
		return res;
	}

// Tokens
identifier "Identifier"
	= id:$([a-zA-Z\.\-_/+*<=>!?$%_&~^@#] [a-zA-Z0-9\-_/+*<=>!?$%_&~^@#]*) { return id }
numberliteral "Numeric Literal"
	= '-' positive:numberliteral { return -positive }
	/ ("0x" / "0X") hexdigits:$([0-9a-fA-F]+) { return parseInt(hexdigits, 16) }
	/ decimal:$([0-9]+ ("." [0-9]+)? ([eE] [+\-]? [0-9]+)?) { return decimal - 0 }
stringliteral "String Literal"
	= "\"" inner:stringcharacter* "\"" { return inner.join('') }
stringcharacter
	= [^"\\\r\n]
	/ "\\u" digits:([a-fA-F0-9] [a-fA-F0-9] [a-fA-F0-9] [a-fA-F0-9]) { 
		return String.fromCharCode(parseInt(digits.join(''), 16))
	}
	/ "\\" which:[^u\r\n] {
		switch(which) {
			case('n'): return "\n"
			case('r'): return "\r"
			case('"'): return "\""
			case('t'): return "\t"
			case('v'): return "\v"
			default: return "\\" + which
		}
	}
	/ "\\" NEWLINE "\\" { return '' }

// Spaces
SPACE_CHARACTER "Space Character"
	= [\t\v\f \u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\uFEFF]
LINE_BREAK "Line Break"
	= "\r"? "\n" 
SPACE_CHARACTER_OR_NEWLINE "Space Character or Newline"
	= [\t\v\f \u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\uFEFF\r\n]
COMMENT "Comment"
	= $(";" [^\r\n]* LINE_BREAK)
SPACES "Space without Newline"
	= $(SPACE_CHARACTER+)
EXPRESSION_SPACE
	= SPACE_CHARACTER_OR_NEWLINE
OPTIONAL_EXPRESSION_SPACES
	= $(EXPRESSION_SPACE*)
NEWLINE
	= LINE_BREAK SPACE_CHARACTER_OR_NEWLINE*