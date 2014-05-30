// PATRISIKA: CPS and Deorthogonalification
// This script uses abstract interpretation which its idea comes from
// Danvy and Filinsiki's paper, Representing Control. The whole abstract
// interpreter takes 3 arguments, form, env and ctx which transforms
// orthogonal syntax tree into regularized syntax tree.

var syntax_rule = require('../commons/match.js').syntax_rule;
var _ = require('../commons/match.js')._;
var atom = require('../commons/match.js').atom;
var empty = require('../commons/match.js').empty;
var any = require('../commons/match.js').any;
var prim = require('../commons/match.js').prim;


var newt = function(){
	var n = 0;
	return function(){
		return '_t' + (++n);
	};
}();

function RET(x){ return ['.return', x] };
function KEY(x){ return x[0] };
function VAL(x){ return x[1] };

// Optimization: Find out all plain subforms.
var plain = syntax_rule(
	[['.lambda', ',args', ',body'], function(form){
		var b = plain(this.body);
		if(b instanceof Array && (b[0] === '&' || b[0] === '&!')) {
			return ['.plain', ['.lambda', this.args, re(b, {}, RET)]]
		} else {
			return ['.plain', ['.lambda', this.args, re(b, {}, RET)]]
		}
	}],
	[['.quote', ',x'], function(form){ return ['.plain', form] }],
	[['.t', ',x'], function(form){ return ['.plain', form] }],
	[['&!', ',x'], function(form){ return ['&!', plain(this.x)] }],
	[['.if', ',..args'],
	 ['.begin', ',..args'],
	 ['.while', ',..args'],
	 ['.return', ',..args'], function(form){ 
		var a = [form[0]].concat(form.slice(1).map(plain));
		for(var j = 1; j < a.length; j++){
			if(a[j] instanceof Array && (a[j][0] === '&' || a[j][0] === '&!')) {
				return ['&'].concat(a);
			}
		};
		return a ;
	}],
	[['.hash', ',..args'], function(form){
		var a = ['.hash'];
		for(var j = 1; j < form.length; j++){
			a[j] = [form[j][0], plain(form[j][1])];
		};
		for(var j = 1; j < a.length; j++){
			if(a[j][1] instanceof Array && (a[j][1][0] === '&' || a[j][1][0] === '&!')) {
				return ['&'].concat(a);
			}
			if(!(a[j][1] && (a[j][1][0] === '.plain'))){
				return a
			}
		};
		return ['.plain', a];
	}],
	[[',..call'], function(form){
		var j0 = prim(form[0]) ? 1 : 0;
		var a = form.slice(0, j0).concat(form.slice(j0).map(plain));
		for(var j = j0; j < a.length; j++){
			if(a[j] instanceof Array && (a[j][0] === '&' || a[j][0] === '&!')) {
				return ['&'].concat(a);
			}
			if(!(a[j] && (a[j][0] === '.plain'))){
				return a
			}
		};
		return ['.plain', a];
	}],
	[atom, function(form){ 
		if(/^\w/.test(form)) return ['.plain', form]
		else return form
	}],
	[any, function(form){ return form }]
)

function id(x){ return x }

// RS: regularize in statement environment, with return value dropped
// ctx accepts regularized form, and combines it with incoming subforms.
var rs = syntax_rule(
	[['.return', ',x'], function(form, env, ctx){ return re(this.x, env, function(x){
		// ctx is not important, and yes, we did DCE here by just simply
		// drop ctx.
		return ['.return', x]
	}) }],
	[['.if', ',cond', ',consequent'], function(form, env, ctx){ return re(form.concat([['.unit']]), env, ctx)}],
	[['.if', ',cond', ',consequent', ',alternate'], function(form, env, ctx){
		var $consequent = this.consequent;
		var $alternate = this.alternate;
		return re(this.cond, env, function(c){
			return ctx(['.if', c, rs($consequent, env, id), rs($alternate, env, id)])
		})
	}],
	[['.while', ',cond', ',body'], function(form, env, ctx){
		if(this.cond instanceof Array && this.cond[0] === '.plain') {
			return ctx(['.while', this.cond[1], rs(this.body, env, id)])
		} else {
			return ra(form[1], env, function(t){
				return ctx(['.while', t, rs(form[2], env, function(x){
					return ['.begin', x, re(form[1], env, function(x){ return ['=', t, x]})]
				})])
			})			
		}
	}],
	[['.begin', ',head', ',..rear'], function(form, env, ctx){
		return rs(this.head, env, function(e){
			return ['.begin', e, rs(['.begin'].concat(form.slice(2)), env, ctx)]
		})
	}],
	[['.begin', ',single'], function(form, env, ctx){
		return rs(this.single, env, ctx)
	}],
	[['.begin'], function(form, env, ctx){ return ctx(['.unit']) }],
	[any, function(form, env, ctx){ return re(form, env, ctx) }]
);

// RE: regularize in expression environment, keep return value.
// `ctx` accepts a plain form, often a T-variable, representing
// the result of evaluating `form`.
var re = syntax_rule(
	[empty, function(form, env, ctx){ return ctx['.unit'] }],
	// Deferred nodes
	[['&!', ',x'], function(form, env, ctx){
		var t = newt();
		return re(this.x, env, function(x){
			return ['.return', [x, ['.lambda', [t], ctx(t)]]]
		})
	}],
	// Flow Controls, Deferred
	[['&', '.return', ',x'], function(form, env, ctx){
		return re(this.x, env, function(x){
			return ['.return', x]
		})
	}],
	[['&', '.begin', ',x'], function(form, env, ctx){
		return re(this.x, env, ctx)
	}],
	[['&', '.begin', ',x', ',..rest'], function(form, env, ctx){
		var $rest = this.rest;
		return ra(this.x, env, function(x){
			return re(['&', '.begin'].concat($rest), env, function(v){
				return ctx(v);
			})
		})
	}],
	[['&', '.if', ',test', ',consequent'], function(form, env, ctx){
		return re(form.concat([['.unit']]), env, ctx)
	}],
	[['&', '.if', ',test', ',consequent', ',alternate'], function(form, env, ctx){
		var $test = this.test, $consequent = this.consequent, $alternate = this.alternate;
		var t = newt();
		var tx = newt();
		return ['.begin', 
			['=', t, ['lambda', [tx], ctx(tx)]], 
			ra($test, env, function(c){
				return ['.if', c, 
					re($consequent, env, function(x){ return ['.return', [t, x]] }),
					re($alternate, env, function(x){ return ['.return', [t, x]] })
				];
			})
		];
	}],
	[['&', '.while', ',test', ',body'], function(form, env, ctx){
		var $test = this.test, $body = this.body;
		var t = newt();
		var tr = newt();
		var tx = newt();
		var trx = newt();
		return ['.begin', 
			['=', t, ['.lambda', [tx], ctx(tx)]], 
			['=', tr, ['.lambda', [trx], ra($test, env, function(c){
				return ['.if', c, 
					re($body, env, function(x){ return ['.return', [tr, x]] }),
					['.return', [t, trx]]
				];
			})]],
			['.return', [tr]]
		];
	}],
	// Flow controls, Plain
	[['.return', ',x'], function(form, env, ctx){
		return re(this.x, env, function(x){ return ['.return', x] })
	}],
	[['.begin', ',..args'], function(form, env, ctx){ return re$b(this.args, env, ctx) }],
	[['.if', ',cond', ',consequent'], function(form, env, ctx){
		var $consequent = this.consequent;
		return re(this.cond, env, function(c){
			var t = newt();
			return ['.begin', ['.if', c, re($consequent, env, function(x){ return ['=', t, x] })], ctx(t)]
		});
	}],
	[['.if', ',cond', ',consequent', ',alternate'], function(form, env, ctx){
		var $consequent = this.consequent;
		var $alternate = this.alternate;
		return re(this.cond, env, function(c){
			var t = newt();
			return ['.begin', ['.if', c, 
				re($consequent, env, function(x){ return ['=', t, x] }),
				re($alternate, env, function(x){ return ['=', t, x] })
			], ctx(t)]
		});
	}],
	[['.while', ',cond', ',body'], function(form, env, ctx){
		var $cond = this.cond;
		var $body = this.body;
		return ra($cond, env, function(c){
			var t = newt();
			return ['.begin', ['.while', c, re($body, env, function(x){
				return ['.begin', ['=', t, x], re($cond, env, function(x){ return ['=', c, x] })]
			})], ctx(t)]
		});
	}],
	// Expressions
	[['.lambda', ',args', ',body'], function(form, env, ectx){ return ctx(form) }],
	[['.quote', ',x'], function(form, env, ctx){ return ctx(form) }],
	[['.unit'], function(form, env, ctx){ return ctx(form) }],
	[['.plain', ',x'], function(form, env, ctx){ return ctx(this.x) }],

	[	['&', '=', ['&', '.', ',obj', ',field'], ',right'], 
		['&', '=', ['.plain', ['.', ',obj', ',field']], ',right'], 
		['&', '=', ['.', ',obj', ',field'], ',right'],
		['=', ['.', ',obj', ',field'], ',right'],
		['=', ['.plain', ['.', ',obj', ',field']], ',right'], 
		function (form, env, ctx){
			var $obj = this.obj, $field = this.field, $right = this.right;
			return ra($obj, env, function(xl){
				return ra($field, env, function(xr){
					return re($right, env, function(r){
						return ctx(['=', ['.', xl, xr], r])
					})
				})
			})
		}],
	[	['&', '=', ['.plain', ',left'], ',right'],
		['&', '=', ',left', ',right'], 
		['=', ['.plain', ',left'], ',right'], 
		['=', ',left', ',right'], 
		function (form, env, ctx){
			var $left = this.left, $right = this.right;
			return re($right, env, function(e){ return ctx(['=', $left, e]) })
		}],
	[	['&', ['.', ',left', ',right'], ',..args'],
		['&', ['.plain', ['.', ',left', ',right']], ',..args'],
		['&', ['&', '.', ',left', ',right'], ',..args'], 
		[['.', ',left', ',right'], ',..args'], 
		function (form, env, ctx){
			var $left = this.left, $right = this.right, $args = this.args;
			return ra($left, env, function(xl){
				return re($right, env, function(xr){
					var t = newt();
					return ['.begin', ['=', t, ['.', xl, xr]], re$($args, env, function(x$){
						if(x$) return ctx([['.', t, ['.quote', 'call']], xl].concat(x$))
						else return ctx([['.', t, ['.quote', 'call']], xl])
					})]
				})
			})
		}],
	[	['&', '.hash', ',..pairs'],
		['.hash', ',..pairs'],
		function(form, env, ctx){
			var $keys = this.pairs.map(KEY);
			var $values = this.pairs.map(VAL);
			return re$($values, env, function(x$){
				var a = [];
				for(var j = 0; j < $keys.length; j++){
					a[j] = [$keys[j], x$[j]]
				};
				return ctx(['.hash'].concat(a));
			})
		}],
	[	['&', _(prim, 'operator'), ',..args'],
		[_(prim, 'operator'), ',..args'],
		function(form, env, ctx){
			var $operator = this.operator, $args = this.args;
			return re$($args, env, function(x$){
				return ctx([$operator].concat(x$))
			})
		}],
	[	['&', ',callee', ',..args'], 
		[',callee', ',..args'], 
		function(form, env, ctx){
			var $args = this.args, $callee = this.callee;
			return ra($callee, env, function(x0){
				return re$($args, env, function(x$){
					return ctx([x0].concat(x$))
				})
			})
		}],
	[any, function(form, env, ctx){ return ctx(form) }]
);

function ra(form, env, ctx){
	return re(form, env, function(x){
		if(typeof x === 'string' && x[0] === '_'){
			return ctx(x)
		} else {
			var t = newt();
			return ['.begin', ['=', t, x], ctx(t)]
		}
	})
}
function re$(form, env, ctx){
	if(!form.length) return ctx([])
	return ra(form[0], env, function(x0){
		return re$(form.slice(1), env, function(x$){
			return ctx([x0].concat(x$))
		})
	})
}
function re$b(form, env, ctx){
	if(!form.length) return ctx(['.unit'])
	else if(form.length === 1) return ra(form[0], env, ctx)
	else return rs(form[0], env, function(x0){
		return ['.begin', x0, re$b(form.slice(1), env, function(x$){
			if(x$) return ctx(x$)
			else return ctx(['.unit'])
		})]
	})
}

function mb(form){
	if(form instanceof Array && form[0] === '.begin'){
		var a = form.slice(1).map(mb);
		var res = [];
		for(var j = 0; j < a.length; j++){
			if(a[j] instanceof Array && a[j][0] === '.begin'){
				res = res.concat(a[j].slice(1))
			} else {
				res.push(a[j])
			}
		};
		return ['.begin'].concat(res);
	} else if(form instanceof Array && form[0] === '.plain') {
		return mb(form[1])
	} else if(form instanceof Array){
		return form.map(mb)
	} else {
		return form
	}
}

exports.pass = function(form){
	return mb(rs(plain(form), {}, id))
}