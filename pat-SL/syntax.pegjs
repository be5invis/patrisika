{
	var textIndentStack = [];
	var textIndent = "";
	function Reference(id){
		this.id = id;
	}
	function composeLine(head, rear){
		var j;
		if(head instanceof Array && (j = head.indexOf(":")) >= 0){
			return head.slice(0, j).concat(rear, head.slice(j + 1))
		} else if(head instanceof Array){
			var r = [];
			for(var j = 0; j < head.length; j++){
				r[j] = composeLine(head[j], rear)
			};
			return r;
		} else {
			return head
		}
	}
}

start = it:block {
	return ['.begin'].concat(it)
}
// Expression
factorStart
	= identifier / numberliteral / stringliteral / "[" / "(" / "{"
factor
	= group
	/ identifier
	/ numberliteral
	/ stringliteral

group
	= "[" OPTIONAL_EXPRESSION_SPACES it:groupInner OPTIONAL_EXPRESSION_SPACES "]" { return it }
	/ "(" OPTIONAL_EXPRESSION_SPACES it:invoke OPTIONAL_EXPRESSION_SPACES ")" { return it }
	/ "{" OPTIONAL_EXPRESSION_SPACES it:groupInner OPTIONAL_EXPRESSION_SPACES "}" { return ['.list'].concat(it) }
	/ "{." OPTIONAL_EXPRESSION_SPACES it:groupInner OPTIONAL_EXPRESSION_SPACES ".}" { return ['.object'].concat(it) }
term
	= head:factor rear:(qualifier*) {
		var res = head;
		for(var j = 0; j < rear.length; j++){
			res = ['.', res, rear[j]];
		};
		return res;
	}
qualifier
	= "." property:identifier { return ['.quote', property] }
groupInner
	= &(factorStart) it:invoke { return it }
	/ &(NEWLINE) INDENT_CLEAR_ON
	  it: block
	  INDENT_CLEAR_OFF
	  NEWLINE* { return it }
block
	= indentBlockContent
	/ NEWLINE_INDENT_SAME? it:blockContent NEWLINE_INDENT_SAME? { return it }
indentBlockContent
	= NEWLINE_INDENT_ADD
	  it:blockContent
	  INDENT_REMOVE { return it }	
blockContent
	= head:line rear:(NEWLINE_INDENT_SAME line)* {
		var res = [head]
		for(var j = 0; j < rear.length; j++){
			res.push(rear[j][1])
		};
		return res;
	}
line
	= head:invoke OPTIONAL_EXPRESSION_SPACES ":" OPTIONAL_EXPRESSION_SPACES rear:line { return head.concat([rear]) }
	/ head:invoke OPTIONAL_EXPRESSION_SPACES rear:indentBlockContent { return head.concat(rear) }
	/ invoke

invoke
	= head:term rear:(OPTIONAL_EXPRESSION_SPACES term)* { 
		var res = [head]
		for(var j = 0; j < rear.length; j++){
			res.push(rear[j][1])
		};
		return res;
	}

// Tokens
identifier "Identifier"
	= id:$([a-zA-Z\-_/+*<=>!?$%_&~^@#] [a-zA-Z0-9\.\-_/+*<=>!?$%_&~^@#]*) { return new Reference(id) }
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
	= SPACE_CHARACTER
OPTIONAL_EXPRESSION_SPACES
	= $(EXPRESSION_SPACE*)

NEWLINE
	= LINE_BREAK SPACE_CHARACTER_OR_NEWLINE*
TEXT_IN_SEGMENT_LINEBREAK "Single Newline"
	= LINE_BREAK INDENT_SAME !(LINE_BREAK)
NEWLINE_INDENT_ADD
	= LINE_BREAK SPACES? NEWLINE_INDENT_ADD
	/ LINE_BREAK INDENT_ADD
NEWLINE_INDENT_SAME
	= LINE_BREAK SPACES? NEWLINE_INDENT_SAME
	/ LINE_BREAK INDENT_SAME
NEWLINE_INDENT_SAME_OR_MORE
	= LINE_BREAK (SPACES? LINE_BREAK)* INDENT_SAME_OR_MORE

POS = { return Position(offset()) }

INDENT_CLEAR_ON  = { textIndentStack.push(textIndent); textIndent = "" }
INDENT_CLEAR_OFF = { textIndent = textIndentStack.pop() }
INDENT_ADD = spaces:SPACES & { return spaces.length > textIndent.length && spaces.slice(0, textIndent.length) === textIndent }
                  { textIndentStack.push(textIndent); textIndent = spaces }
INDENT_REMOVE = { textIndent = textIndentStack.pop() }
INDENT_SAME = spaces:$(SPACES?) & { return spaces === textIndent }
INDENT_SAME_OR_MORE = spaces:$(SPACES?) & { return spaces === textIndent || spaces.slice(0, textIndent.length) === textIndent }