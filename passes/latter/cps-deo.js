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
var isStatement = require('../commons/nodetype.js').isStatement;


var newt = function(){
	var n = 0;
	return function(){
		return '_t' + (++n);
	};
}();

function RET(x){ return ['.return', x] }

// Optimization: Find out all plain subforms.
var plain = syntax_rule(
	[['.lambda', ',args', ',body'], function(form){
		var b = plain(this.body);
		if(b instanceof Array && (b[0] === '&' || b[0] === '&!')) {
			return ['.plain', ['.lambda', this.args, cps(b, {}, RET)]]
		} else {
			return ['.plain', ['.lambda', this.args, re(b, RET)]]
		}
	}],
	[['.quote', ',x'], function(form){ return ['.plain', form] }],
	[['.t', ',x'], function(form){ return ['.plain', form] }],
	[['&!', ',x'], function(form){ return ['&!', plain(this.x)] }],
	[isStatement, function(form){ 
		var a = [form[0]].concat(form.slice(1).map(plain));
		for(var j = 1; j < a.length; j++){
			if(a[j] instanceof Array && (a[j][0] === '&' || a[j][0] === '&!')) {
				return ['&'].concat(a);
			}
		};
		return a ;
	}],
	[[',..call'], function(form){
		var j0 = (typeof form[0] === 'string' && !(/\w/.test(form[0]))) ? 1 : 0;
		var a = form.slice(0, j0).concat(form.slice(j0).map(plain));
		for(var j = j0; j < a.length; j++){
			if(a[j] instanceof Array && (a[j][0] === '&' || a[j][0] === '&!')) {
				return ['&'].concat(a);
			}
			if(!(a[j] && (a[j][0] === '.plain'))){
				return a
			}
		};
		return ['.plain', a.slice(0, j0).concat(a.slice(j0).map(function(x){ return x[1] }))];
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
	[['.return', ',x'], function(){ return re(this.x, function(x){
		// ctx is not important, and yes, we did DCE here by just simply
		// drop ctx.
		return ['.return', x]
	}) }],
	[['.if', ',cond', ',consequent'], function(form, ctx){ return re(form.concat([['.unit']]), ctx)}],
	[['.if', ',cond', ',consequent', ',alternate'], function(form, ctx){
		var $consequent = this.consequent;
		var $alternate = this.alternate;
		return re(this.cond, function(c){
			return ctx(['.if', c, rs($consequent, id), rs($alternate, id)])
		})
	}],
	[['.while', ',cond', ',body'], function(form, ctx){
		if(this.cond instanceof Array && this.cond[0] === '.plain') {
			return ctx(['.while', this.cond[1], rs(this.body, id)])
		} else {
			return ra(form[1], function(t){
				return ctx(['.while', t, rs(form[2], function(x){
					return ['.begin', x, re(form[1], function(x){ return ['=', t, x]})]
				})])
			})			
		}
	}],
	[['.begin', ',head', ',..rear'], function(form, ctx){
		return rs(this.head, function(e){
			return ['.begin', e, rs(['.begin'].concat(form.slice(2)), ctx)]
		})
	}],
	[['.begin', ',single'], function(form, ctx){
		return rs(this.single, ctx)
	}],
	[['.begin'], function(form, ctx){ return ctx(['.unit']) }],
	[any, function(form, ctx){ return re(form, ctx) }]
)

// RE: regularize in expression environment, keep return value.
// `ctx` accepts a plain form, often a T-variable, representing
// the result of evaluating `form`.
var re = syntax_rule(
	[empty, function(form){ return ctx['.unit'] }],
	[['.lambda', ',args', ',body'], function(form, ctx){ return ctx(form) }],
	[['.quote', ',x'], function(form, ctx){ return ctx(form) }],
	[['.unit'], function(form, ctx){ return ctx(form) }],
	[['.plain', ',x'], function(form, ctx){ return ctx(this.x) }],
	[['.return', ',x'], function(form, ctx){
		return re(this.x, function(x){ return ['.return', x] })
	}],
	[['.if', ',cond', ',consequent'], function(form, ctx){
		var $consequent = this.consequent;
		return re(this.cond, function(c){
			var t = newt();
			return ['.begin', ['.if', c, re($consequent, function(x){ return ['=', t, x] })], ctx(t)]
		});
	}],
	[['.if', ',cond', ',consequent', ',alternate'], function(form, ctx){
		var $consequent = this.consequent;
		var $alternate = this.alternate;
		return re(this.cond, function(c){
			var t = newt();
			return ['.begin', ['.if', c, 
				re($consequent, function(x){ return ['=', t, x] }),
				re($alternate, function(x){ return ['=', t, x] })
			], ctx(t)]
		});
	}],
	[['.while', ',cond', ',body'], function(form, ctx){
		var $cond = this.cond;
		var $body = this.body;
		return ra($cond, function(c){
			var t = newt();
			return ['.begin', ['.while', c, re($body, function(x){
				return ['.begin', ['=', t, x], re($cond, function(x){ return ['=', c, x] })]
			})], ctx(t)]
		});
	}],
	[	['=', ['.', ',obj', ',field'], ',right'],
		['=', ['.plain', ['.', ',obj', ',field']], ',right'], 
			function(form, ctx){
			var $obj = this.obj, $field = this.field, $right = this.right;
			return ra($obj, function(xl){
				return ra($field, function(xr){
					return re($right, function(r){
						return ctx(['=', ['.', xl, xr], r])
					})
				})
			})
		}],
	[	['=', ['.plain', ',left'], ',right'], 
		['=', ',left', ',right'], 
		function(form, ctx){
			var $left = this.left, $right = this.right;
			return re($right, function(e){ return ctx(['=', $left, e]) })
		}],
	[['.begin', ',..args'], function(form, ctx){ return re$b(this.args, ctx) }],
	[[['.', ',left', ',right'], ',..args'], function(form, ctx){
		var $left = this.left, $right = this.right, $args = this.args;
		return ra($left, function(xl){
			return re($right, function(xr){
				var t = newt();
				return ['.begin', ['=', t, ['.', xl, xr]], re$($args, function(x$){
					if(x$) return ctx([['.', t, ['.quote', 'call']], xl].concat(x$))
					else return ctx([['.', t, ['.quote', 'call']], xl])
				})]
			})
		})
	}],
	[[',fn', ',..args'], re$],
	[any, function(form, ctx){ return ctx(form) }]
)

function ra(form, ctx){
	return re(form, function(x){
		if(typeof x === 'string' && x[0] === '_'){
			return ctx(x)
		} else {
			var t = newt();
			return ['.begin', ['=', t, x], ctx(t)]
		}
	})
}
function re$(form, ctx){
	if(!form.length) return ctx(null)
	return ra(form[0], function(x0){
		return re$(form.slice(1), function(x$){
			if(x$) return ctx([x0].concat(x$))
			else return ctx([x0])
		})
	})
}
function re$b(form, ctx){
	if(!form.length) return ctx(['.unit'])
	else if(form.length === 1) return ra(form[0], ctx)
	else return rs(form[0], function(x0){
		return ['.begin', x0, re$b(form.slice(1), function(x$){
			if(x$) return ctx(x$)
			else return ctx(['.unit'])
		})]
	})
}


// CPS [& form] into 
var cps = syntax_rule(
	[['&!', ',x'], function(form, env, ctx){
		var t = newt();
		return cps(this.x, env, function(x){
			return ['.return', [x, ['.lambda', [t], ctx(t)]]]
		})
	}],
	[['&', '.return', ',x'], function(form, env, ctx){
		return cps(this.x, env, function(x){
			return ['.return', x]
		})
	}],
	[['&', '.if', ',test', ',consequent'], function(form, env, ctx){
		return cps(form.concat([['.unit']]), env, ctx)
	}],
	[['&', '.if', ',test', ',consequent', ',alternate'], function(form, env, ctx){
		var $test = this.test, $consequent = this.consequent, $alternate = this.alternate;
		var t = newt();
		var tx = newt();
		return ['.begin', 
			['=', t, ['lambda', [tx], ctx(tx)]], 
			cpsa($test, env, function(c){
				return ['.if', c, 
					cps($consequent, env, function(x){ return ['.return', [t, x]] }),
					cps($alternate, env, function(x){ return ['.return', [t, x]] })
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
			['=', tr, ['.lambda', [trx], cpsa($test, env, function(c){
				return ['.if', c, 
					cps($body, env, function(x){ return ['.return', [tr, x]] }),
					[t, trx]
				];
			})]],
			['.return', [tr]]
		];
	}],
	[	['&', '=', ['&', '.', ',obj', ',field'], ',right'], 
		['&', '=', ['.plain', ['.', ',obj', ',field']], ',right'], 
		['&', '=', ['.', ',obj', ',field'], ',right'], 
		function(form, env, ctx){
			var $obj = this.obj, $field = this.field, $right = this.right;
			return cpsa($obj, env, function(o){
				return cpsa($field, env, function(f){
					return cps($right, env, function(r){
						return ctx(['=', ['.', o, f], r])
					})
				})
			})
		}],
	[	['&', '=', ['.plain', ',left'], ',right'],
		['&', '=', ',left', ',right'], 
		function(form, env, ctx){
			var $left = this.left, $right = this.right;
			return cps($right, env, function(r){ return ctx(['=', $left, r])})
		}],
	[	['&', ['.', ',left', ',right'], ',..args'],
		['&', ['.plain', ['.', ',left', ',right']], ',..args'],
		['&', ['&', '.', ',left', ',right'], ',..args'], 
		function (form, env, ctx){
			var $left = this.left, $right = this.right, $args = this.args;
			return cpsa($left, env, function(xl){
				return cpsa($right, env, function(xr){
					var t = newt();
					return ['.begin', ['=', t, ['.', xl, xr]],
						cps$($args, env, function(x$){
							return ctx([['.', t, ['.quote', 'call']], xl].concat(x$))
						})
					]
				})
			})
		}],
	[['&', ',callee', ',..args'], function(form, env, ctx){
		var $args = this.args;
		return cpsa(this.callee, env, function(x0){
			return cps$($args, env, function(x$){
				return ctx([x0].concat(x$))
			})
		})
	}],
	[any, function(form, env, ctx){ return re(form, ctx) }]
);
var cpsa = function(form, env, ctx){
	return cps(form, env, function(x){
//		if(typeof x === 'string' && x[0] === '_') return ctx(x);
		var t = newt();
		return ['.begin', ['=', t, x], ctx(t)]
	})
}
function cps$(form, env, ctx){
	if(!form.length) return ctx([])
	return cpsa(form[0], env, function(x0){
		return cps$(form.slice(1), env, function(x$){
			return ctx([x0].concat(x$))
		})
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
	} else if(form instanceof Array){
		return form.map(mb)
	} else {
		return form
	}
}

exports.pass = function(form){
	return mb(rs(plain(form), id))
}