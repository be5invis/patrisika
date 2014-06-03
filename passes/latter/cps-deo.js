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
function GEN_FINISH(x){ return ['.return', ['.hash', ['done', ['.quote', true]], ['value', x]]] };
function KEY(x){ return x[0] };
function VAL(x){ return x[1] };

// Optimization: Find out all trivial subforms.
var trivial = syntax_rule(
	[['.lambda', ',args', ',body'], function(form){
		var b = trivial(this.body);
		if(b instanceof Array && (b[0] === '&' || b[0] === '&!')) {
			var env = {};
			env.isGenerator = true;
			env.tStep = newt();
			env.tNext = newt();
			env.tCatch = newt();
			return ['.trivial', ['.lambda', this.args, ['.begin', 
				['=', env.tStep, ['.lambda', [], re(b, env, GEN_FINISH)]],
				['=', env.tNext, ['.lambda', ['x'], ['.try', ['.return', [env.tStep, 'x']], 'ex', ['.return', [env.tCatch, 'ex']]]]],
				['=', env.tCatch, ['.lambda', ['e'], ['.throw', 'e']]],
				['.return', env.tNext]
			]]]
		} else {
			return ['.trivial', ['.lambda', this.args, re(b, {}, RET)]]
		}
	}],
	[['.quote', ',x'], function(form){ return ['.trivial', form] }],
	[['.t', ',x'], function(form){ return ['.trivial', form] }],
	[['&!', ',x'], function(form){ return ['&!', trivial(this.x)] }],
	[['.if', ',..args'],
	 ['.begin', ',..args'],
	 ['.while', ',..args'],
	 ['.return', ',..args'], 
	 ['.throw', ',..args'], 
	 ['.try', ',..args'], function(form){ 
		var a = [form[0]].concat(form.slice(1).map(trivial));
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
			a[j] = [form[j][0], trivial(form[j][1])];
		};
		var delaied = false;
		var trivialForm = true;
		for(var j = 1; j < a.length; j++){
			if(a[j][1] instanceof Array && (a[j][1][0] === '&' || a[j][1][0] === '&!')) {
				delaied = true
			}
			if(!(a[j][1] && (a[j][1][0] === '.trivial'))){
				trivialForm = false;
			}
		};
		if(delaied){
			return ['&'].concat(a)
		} else if(trivialForm){
			return ['.trivial', a];
		} else {
			return a;
		}
	}],
	[[',..call'], function(form){
		var j0 = prim(form[0]) ? 1 : 0;
		var a = form.slice(0, j0).concat(form.slice(j0).map(trivial));
		var delaied = false;
		var trivialForm = true;
		for(var j = j0; j < a.length; j++){
			if(a[j] instanceof Array && (a[j][0] === '&' || a[j][0] === '&!')) {
				delaied = true
			}
			if(!(a[j] && (a[j][0] === '.trivial'))){
				trivialForm = false;
			}
		};
		if(delaied){
			return ['&'].concat(a)
		} else if(trivialForm){
			return ['.trivial', a];
		} else {
			return a;
		}
	}],
	[atom, function(form){ 
		if(/^\w/.test(form)) return ['.trivial', form]
		else return form
	}],
	[any, function(form){ return form }]
)

function id(x){ return x }

// RS: regularize in statement environment, with return value dropped
// ctx accepts regularized form, and combines it with incoming subforms.
var rs = syntax_rule(
	// NOTE: Treatment on Return and Throw nodes are IDENTICAL to those in re.
	[['.if', ',cond', ',consequent'], function(form, env, ctx){ return re(form.concat([['.unit']]), env, ctx)}],
	[['.if', ',cond', ',consequent', ',alternate'], function(form, env, ctx){
		var $consequent = this.consequent;
		var $alternate = this.alternate;
		return re(this.cond, env, function(c){
			return ctx(['.if', c, rs($consequent, env, id), rs($alternate, env, id)])
		})
	}],
	[['.while', ',cond', ',body'], function(form, env, ctx){
		if(this.cond instanceof Array && this.cond[0] === '.trivial') {
			return ctx(['.while', this.cond[1], rs(this.body, env, id)])
		} else {
			return ra(form[1], env, function(t){
				return ctx(['.while', t, rs(form[2], env, function(x){
					return ['.begin', x, re(form[1], env, function(x){ return ['=', t, x]})]
				})])
			})			
		}
	}],
	[['.try', ',block', ',param', ',handler'], function(form, env, ctx){
		return ctx(['.try', rs(this.block, env, id), this.param, rs(this.handler, env, id)]);
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
// `ctx` accepts a trivial form, often a T-variable, representing
// the result of evaluating `form`.
var re = syntax_rule(
	[empty, function(form, env, ctx){ return ctx(['.unit']) }],
	// Deferred nodes
	[['&!', ',x'], function(form, env, ctx){
		var t = newt();
		return re(this.x, env, function(x){
			return ['.begin',
				['=', env.tStep, ['.lambda', [t], ctx(t)]],
				['.return', ['.hash',
					['value', x],
					['next', env.tNext],
					['throw', env.tCatch],
					['done', ['.quote', false]]
				]]
			]
		})
	}],
	// Flow Controls, Deferred
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
	[['&', '.try', ',block', ',param', ',handler'], function(form, env, ctx){
		var $block = this.block, $param = this.param, $handler = this.handler;
		var t = newt(), tx = newt(), te = newt();
		var b = newt();
		return ['.begin',
			['=', t, ['.lambda', [tx], ctx(tx)]],
			['=', b, env.tCatch],
			['=', env.tStep, ['.lambda', [], re($block, env, function(x){ return ['.return', [t, x]]})]],
			['=', env.tCatch, ['.lambda', [te], ['.begin',
				['=', $param, te],
				re($handler, env, function(x){
					return ['.begin',
						['=', env.tCatch, b],
						['.return', [t, x]]
					]
				})
			]]],
			['.return', [env.tNext]]
		]
	}],
	// Flow controls, Plain
	[['&', '.return', ',x'], ['.return', ',x'], function(form, env, ctx){
		if(env.isGenerator){
			return re(this.x, env, GEN_FINISH)
		} else {
			return re(this.x, env, RET)
		}
	}],
	[['&', '.throw', ',x'], ['.throw', ',x'], function(form, env, ctx){
		if(env.isGenerator){
			return re(this.x, env, function(x){ return ['.return', [env.tCatch, x]] })
		} else {
			return re(this.x, env, function(x){ return ['.throw', x] })
		}
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
	[['.try', ',block', ',param', ',handler'], function(form, env, ctx){
		var $block = this.block;
		var $param = this.param;
		var $handler = this.handler;
		var t = newt();
		return ['.begin', ['.try', re($block, env, function(x){ return ['=', t, x] }), $param, 
			re($handler, env, function(x){ return ['=', t, x] })], ctx(t)];
	}],
	// Expressions
	[['.lambda', ',args', ',body'], function(form, env, ectx){ return ctx(form) }],
	[['.quote', ',x'], function(form, env, ctx){ return ctx(form) }],
	[['.unit'], function(form, env, ctx){ return ctx(form) }],
	[['.trivial', ',x'], function(form, env, ctx){ return ctx(this.x) }],

	[	['&', '=', ['&', '.', ',obj', ',field'], ',right'], 
		['&', '=', ['.trivial', ['.', ',obj', ',field']], ',right'], 
		['&', '=', ['.', ',obj', ',field'], ',right'],
		['=', ['.', ',obj', ',field'], ',right'],
		['=', ['.trivial', ['.', ',obj', ',field']], ',right'], 
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
	[	['&', '=', ['.trivial', ',left'], ',right'],
		['&', '=', ',left', ',right'], 
		['=', ['.trivial', ',left'], ',right'], 
		['=', ',left', ',right'], 
		function (form, env, ctx){
			var $left = this.left, $right = this.right;
			return re($right, env, function(e){ return ctx(['=', $left, e]) })
		}],
	[	['&', ['.', ',left', ',right'], ',..args'],
		['&', ['.trivial', ['.', ',left', ',right']], ',..args'],
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
	} else if(form instanceof Array && form[0] === '.trivial') {
		return mb(form[1])
	} else if(form instanceof Array){
		return form.map(mb)
	} else {
		return form
	}
}

exports.pass = function(form){
	return mb(rs(trivial(form), {}, id))
}