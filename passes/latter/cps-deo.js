// PATRISIKA: CPS and Deorthogonalification
// This script uses abstract interpretation which its idea comes from
// Danvy and Filinsiki's paper, Representing Control. The whole abstract
// interpreter takes 3 arguments, form, env and k which transforms
// orthogonal syntax tree into regularized syntax tree.

var syntax_rule = require('../commons/match.js').syntax_rule;
var _ = require('../commons/match.js')._;
var atom = require('../commons/match.js').atom;
var empty = require('../commons/match.js').empty;
var any = require('../commons/match.js').any;
var prim = require('../commons/match.js').prim;

var Scope = require('../commons/scope.js').Scope;

function isDelaied(form) {
	return form instanceof Array && (form[0] === '&' || form[0] === '&!')
}


function RET(x){ return ['.return', x] };
function GEN_FINISH(x){ return ['.return', ['.hash', ['done', ['.quote', true]], ['value', x]]] };
function KEY(x){ return x[0] };
function VAL(x){ return x[1] };

// Optimization: Find out all trivial subforms.
var trivial = syntax_rule(
	[['.lambda', ',args', ',body'], function(form){
		return ['.trivial', ['.lambda', this.args, trivial(this.body)]]
	}],
	[['.quote', ',x'], function(form){ return ['.trivial', form] }],
	[['.t', ',x'], function(form){ return ['.trivial', form] }],
	[['.yield', ',x'], function(form){ return ['&!', trivial(this.x)] }],
	[['.if', ',..args'],
	 ['.begin', ',..args'],
	 ['.while', ',..args'],
	 ['.return', ',..args'], 
	 ['.throw', ',..args'], function(form){ 
		var a = [form[0]];
		for(var j = 1; j < form.length; j++){
			a[j] = trivial(form[j])
		}
		for(var j = 1; j < a.length; j++){
			if(isDelaied(a[j])) {
				return ['&', a];
			}
		};
		return a ;
	}],
	[['.try', ',block', [_('param', atom)], ',handler'], function(form){
		var $block = trivial(this.block);
		var $handler = trivial(this.handler);
		//env.declare(this.param);
		if(isDelaied($block) || isDelaied($handler)) { return ['&', '.try', $block, [this.param], $handler] }
		else { return ['.try', $block, [this.param], $handler] }
	}],
	[['.hash', ',..args'], function(form){
		var a = ['.hash'];
		for(var j = 1; j < form.length; j++){
			a[j] = [form[j][0], trivial(form[j][1])];
		};
		var delaied = false;
		var trivialForm = true;
		for(var j = 1; j < a.length; j++){
			if(isDelaied(a[j][1])) {
				delaied = true
			}
			if(!(a[j][1] && (a[j][1][0] === '.trivial'))){
				trivialForm = false;
			}
		};
		if(delaied){
			return ['&', a]
		} else if(trivialForm){
			return ['.trivial', a];
		} else {
			return a;
		}
	}],
	[[',..call'], function(form){
		var j0 = prim(form[0]) ? 1 : 0;
		var a = form.slice(0);
		for(var j = j0; j < form.length; j++){
			a[j] = trivial(form[j])
		}
		var delaied = false;
		var trivialForm = true;
		for(var j = j0; j < a.length; j++){
			if(isDelaied(a[j])) {
				delaied = true
			}
			if(!(a[j] && (a[j][0] === '.trivial'))){
				trivialForm = false;
			}
		};
		if(delaied){
			return ['&', a]
		} else if(trivialForm){
			return ['.trivial', a];
		} else {
			return a;
		}
	}],
	[atom, function(form){ 
		if(/^\W/.test(form)) return form
		else return ['.trivial', form]
	}],
	[any, function(form){ return form }]
)

function id(x){ return x }

// RS: regularize in statement environment, with return value dropped
// k accepts regularized form, and combines it with incoming subforms.
var rs = syntax_rule(
	// NOTE: Treatment on Return and Throw nodes are IDENTICAL to those in re.
	[['.if', ',cond', ',consequent'], function(form, env, k){ return re(form.concat([['.unit']]), env, k)}],
	[['.if', ',cond', ',consequent', ',alternate'], function(form, env, k){
		var $consequent = this.consequent;
		var $alternate = this.alternate;
		return re(this.cond, env, function(c){
			return k(['.if', c, rs($consequent, env, id), rs($alternate, env, id)])
		})
	}],
	[['.while', ',cond', ',body'], function(form, env, k){
		if(this.cond instanceof Array && this.cond[0] === '.trivial') {
			return k(['.while', this.cond[1], rs(this.body, env, id)])
		} else {
			return ra(form[1], env, function(t){
				return k(['.while', t, rs(form[2], env, function(x){
					return ['.begin', x, re(form[1], env, function(x){ return ['.set', t, x]})]
				})])
			})			
		}
	}],
	[['.try', ',block', [',param'], ',handler'], function(form, env, k){
		return k(['.try', rs(this.block, env, id), [this.param], rs(this.handler, env, id)]);
	}],
	[['.begin', ',head', ',..rear'], function(form, env, k){
		return rs(this.head, env, function(e){
			return ['.begin', e, rs(['.begin'].concat(form.slice(2)), env, k)]
		})
	}],
	[['.begin', ',single'], function(form, env, k){
		return rs(this.single, env, k)
	}],
	[['.begin'], function(form, env, k){ return k(['.unit']) }],
	[any, function(form, env, k){ return re(form, env, k) }]
);

// RE: regularize in expression environment, keep return value.
// `k` accepts a trivial form, often a T-variable, representing
// the result of evaluating `form`.
var re = syntax_rule(
	[empty, function(form, env, k){ return k(['.unit']) }],
	// Deferred nodes
	[['&!', ',x'], function(form, env, k){
		var t = env.newt();
		return re(this.x, env, function(x){
			return ['.begin',
				['.set', env.tStep, ['.lambda', [t], k(t)]],
				['.return', ['.hash',
					['value', x],
					['done', ['.quote', false]]
				]]
			]
		})
	}],
	// Flow Controls, Deferred
	[['&', ['.begin', ',x']], function(form, env, k){
		return re(this.x, env, k)
	}],
	[['&', ['.begin', ',x', ',..rest']], function(form, env, k){
		var $rest = this.rest;
		return ra(this.x, env, function(x){
			return re(['&', '.begin'].concat($rest), env, function(v){
				return k(v);
			})
		})
	}],
	[['&', ['.if', ',test', ',consequent']], function(form, env, k){
		return re(['&', ['.if', this.test, this.consequent, ['.unit']]], env, k)
	}],
	[['&', ['.if', ',test', ',consequent', ',alternate']], function(form, env, k){
		var $test = this.test, $consequent = this.consequent, $alternate = this.alternate;
		var t = env.newt();
		var tx = env.newt();
		return ['.begin', 
			['.set', t, ['lambda', [tx], k(tx)]], 
			ra($test, env, function(c){
				return ['.if', c, 
					re($consequent, env, function(x){ return ['.return', [t, x]] }),
					re($alternate, env, function(x){ return ['.return', [t, x]] })
				];
			})
		];
	}],
	[['&', ['.while', ',test', ',body']], function(form, env, k){
		var $test = this.test, $body = this.body;
		var t = env.newt();
		var tr = env.newt();
		var tx = env.newt();
		var trx = env.newt();
		return ['.begin', 
			['.set', t, ['.lambda', [tx], k(tx)]], 
			['.set', tr, ['.lambda', [trx], ra($test, env, function(c){
				return ['.if', c, 
					re($body, env, function(x){ return ['.return', [tr, x]] }),
					['.return', [t, trx]]
				];
			})]],
			['.return', [tr]]
		];
	}],
	[['&', ['.try', ',block', [',param'], ',handler']], function(form, env, k){
		var $block = this.block, $param = this.param, $handler = this.handler;
		env.declare($param);
		var t = env.newt(), tx = env.newt(), te = env.newt();
		var b = env.newt();
		return ['.begin',
			['.set', t, ['.lambda', [tx], 
				['.begin', ['.set', env.tCatch, b], k(tx)]]],
			['.set', b, env.tCatch],
			['.set', env.tStep, ['.lambda', [], re($block, env, function(x){ return ['.return', [t, x]]})]],
			['.set', env.tCatch, ['.lambda', [te], ['.begin',
				['.set', env.use($param), te],
				re($handler, env, function(x){
					return ['.begin',
						['.set', env.tCatch, b],
						['.return', [t, x]]
					]
				})
			]]],
			['.return', [env.tNext]]
		]
	}],
	// Flow controls, Plain
	[['&', ['.return', ',x']], ['.return', ',x'], function(form, env, k){
		if(env.isGenerator){
			return re(this.x, env, GEN_FINISH)
		} else {
			return re(this.x, env, RET)
		}
	}],
	[['&', ['.throw', ',x']], ['.throw', ',x'], function(form, env, k){
		if(env.isGenerator){
			return re(this.x, env, function(x){ return ['.return', [env.tCatch, x]] })
		} else {
			return re(this.x, env, function(x){ return ['.throw', x] })
		}
	}],
	[['.begin'], function(form, env, k){ return k(['.unit']) }],
	[['.begin', ',x'], function(form, env, k){ return re(this.x, env, k) }],
	[['.begin', ',x', ',..rest'], function(form, env, k){
		var $x = this.x, $rest = this.rest;
		return rs($x, env, function(s){
			return ['.begin', s, re(['.begin'].concat($rest), env, function(rest){
				return k(rest)
			})]
		})
	}],
//	[['.begin', ',..args'], function(form, env, k){ return re$b(this.args, env, k) }],
	[['.if', ',cond', ',consequent'], function(form, env, k){
		var $consequent = this.consequent;
		return re(this.cond, env, function(c){
			var t = env.newt();
			return ['.begin', ['.if', c, re($consequent, env, function(x){ return ['.set', t, x] })], k(t)]
		});
	}],
	[['.if', ',cond', ',consequent', ',alternate'], function(form, env, k){
		var $consequent = this.consequent;
		var $alternate = this.alternate;
		return re(this.cond, env, function(c){
			var t = env.newt();
			return ['.begin', ['.if', c, 
				re($consequent, env, function(x){ return ['.set', t, x] }),
				re($alternate, env, function(x){ return ['.set', t, x] })
			], k(t)]
		});
	}],
	[['.while', ',cond', ',body'], function(form, env, k){
		var $cond = this.cond;
		var $body = this.body;
		return ra($cond, env, function(c){
			var t = env.newt();
			return ['.begin', ['.while', c, re($body, env, function(x){
				return ['.begin', ['.set', t, x], re($cond, env, function(x){ return ['.set', c, x] })]
			})], k(t)]
		});
	}],
	[['.try', ',block', [',param'], ',handler'], function(form, env, k){
		var $block = this.block;
		var $param = this.param;
		var $handler = this.handler;
		env.declare($param);
		var t = env.newt();
		return ['.begin', ['.try', re($block, env, function(x){ return ['.set', t, x] }), [env.use($param)],
			re($handler, env, function(x){ return ['.set', t, x] })], k(t)];
	}],
	// Trivial Expressions
	[	['.trivial', ['.lambda', ',args', ',body']], 
		['.lambda', ',args', ',body'],
		function(form, env, k){ 
			var derived = new Scope(env);
			for(var j = 0; j < this.args.length; j++){
				derived.declare(this.args[j], true);
			}
			var b = this.body;
			if(b instanceof Array && (b[0] === '&' || b[0] === '&!')) {
				derived.isGenerator = true;
				derived.tStep = env.newt();
				derived.tNext = env.newt();
				derived.tCatch = env.newt();
				return k(['.lambda', this.args, ['.begin', 
					['.set', derived.tStep, ['.lambda', [], re(b, derived, GEN_FINISH)]],
					['.set', derived.tNext, ['.lambda', ['x'], ['.try', ['.return', [derived.tStep, 'x']], ['ex'], ['.return', [derived.tCatch, 'ex']]]]],
					['.set', derived.tCatch, ['.lambda', ['e'], ['.throw', 'e']]],
					['.return', ['.hash',
						['next', derived.tNext],
						['throw', derived.tCatch]
					]]
				], derived])
			} else {
				return k(['.lambda', this.args, re(b, derived, RET), derived])
			}
		}],
	[	['.trivial', _('x', atom)],
		_('x', atom),
		function(form, env, k){
			return k(env.use(this.x))
		}],
	[	['.trivial', ['.quote', ',x']],
		['.quote', ',x'], function(form, env, k){ return k(form) }],
	[	['.trivial', ['.local', ['.trivial', _('x', atom)]]],
		['.trivial', ['.local', _('x', atom)]],
		['.local', ['.trivial', _('x', atom)]],
		['.local', _('x', atom)],
		function(form, env, k){ 
			env.declare(this.x); 
			return k(env.use(this.x))
		}],
	[	['.trivial', ['.unit']],
		['.unit'], function(form, env, k){ return k(form) }],
	[['.trivial', [_('operator', prim), ',..args']], function(form, env, k){
		var $operator = this.operator, $args = this.args;
		return ret$($args, env, function(args){
			return k([$operator].concat(args))
		})
	}],
	[['.trivial', [',callee', ',..args']], function(form, env, k){
		var $callee = this.callee, $args = this.args;
		return re($callee, env, function(callee){
			return ret$($args, env, function(args){
				return k([callee].concat(args))
			})
		})
	}],
	[['.quote', ',x'], function(form, env, k){ return k(form) }],
	[['.unit'], function(form, env, k){ return k(form) }],
	[['.trivial', ',x'], function(form, env, k){ return k(this.x) }],

	// Other Expressions
	[	['&', ['.set', ['&', ['.', ',obj', ',field']], ',right']], 
		['&', ['.set', ['.trivial', ['.', ',obj', ',field']], ',right']], 
		['&', ['.set', ['.', ',obj', ',field'], ',right']],
		['.set', ['.', ',obj', ',field'], ',right'],
		['.set', ['.trivial', ['.', ',obj', ',field']], ',right'], 
		function (form, env, k){
			var $obj = this.obj, $field = this.field, $right = this.right;
			return ra($obj, env, function(xl){
				return ra($field, env, function(xr){
					return re($right, env, function(r){
						return k(['.set', ['.', xl, xr], r])
					})
				})
			})
		}],
	[	['&', ['.set', ['.trivial', ',left'], ',right']],
		['&', ['.set', ',left', ',right']], 
		['.set', ['.trivial', ',left'], ',right'], 
		['.set', ',left', ',right'], 
		function (form, env, k){
			var $left = this.left, $right = this.right;
			return re($right, env, function(e){ return k(['.set', $left, e]) })
		}],
	[	['&', [['.', ',left', ',right'], ',..args']],
		['&', [['.trivial', ['.', ',left', ',right']], ',..args']],
		['&', [['&', '.', ',left', ',right'], ',..args']], 
		[['.', ',left', ',right'], ',..args'], 
		function (form, env, k){
			var $left = this.left, $right = this.right, $args = this.args;
			return ra($left, env, function(xl){
				return re($right, env, function(xr){
					var t = env.newt();
					return ['.begin', ['.set', t, ['.', xl, xr]], re$($args, env, function(x$){
						if(x$) return k([['.', t, ['.quote', 'call']], xl].concat(x$))
						else return k([['.', t, ['.quote', 'call']], xl])
					})]
				})
			})
		}],
	[	['&', ['.hash', ',..pairs']],
		['.hash', ',..pairs'],
		function(form, env, k){
			var $keys = this.pairs.map(KEY);
			var $values = this.pairs.map(VAL);
			return re$($values, env, function(x$){
				var a = [];
				for(var j = 0; j < $keys.length; j++){
					a[j] = [$keys[j], x$[j]]
				};
				return k(['.hash'].concat(a));
			})
		}],
	[['&', ['&&']], function(form, env, k){ return k(['.quote', true]) }],
	[['&', ['&&', ',x']], function(form, env, k){ return re(this.x, env, k) }],
	[['&', ['&&', ',x', ',..rest']], function(form, env, k){
		var $rest = this.rest;
		return ra(this.x, env, function(x){
			var t = env.newt();
			var tx = env.newt();
			return ['.begin', 
				['.set', t, ['.lambda', [tx], k(tx)]],
				['.if', x, re(['&', ['&&'].concat($rest)], env, function(x){ return ['.return', [t, x]] }), ['.return', [t, x]]]
			]
		})
	}],
	[['&', ['||']], function(form, env, k){ return k(['.quote', false]) }],
	[['&', ['||', ',x']], function(form, env, k){ return re(this.x, env, k) }],
	[['&', ['||', ',x', ',..rest']], function(form, env, k){
		var $rest = this.rest;
		return ra(this.x, env, function(x){
			var t = env.newt();
			var tx = env.newt();
			return ['.begin', 
				['.set', t, ['.lambda', [tx], k(tx)]],
				['.if', x, ['.return', [t, x]], re(['&', ['||'].concat($rest)], env, function(x){ return ['.return', [t, x]] })]
			]
		})
	}],
	[['&&'], function(form, env, k){ return k(['.quote', true]) }],
	[['&&', ',x'], function(form, env, k){ return re(this.x, env, k) }],
	[['&&', ',x', ',..rest'], function(form, env, k){
		var $rest = this.rest;
		return ra(this.x, env, function(x){
			var t = env.newt();
			return ['.begin', 
				['.if', x, re(['&', ['&&'].concat($rest)], env, function(x){ return ['.set', t, x] }), ['.set', t, x]],
				k(t)
			]
		})
	}],
	[['||'], function(form, env, k){ return k(['.quote', false]) }],
	[['||', ',x'], function(form, env, k){ return re(this.x, env, k) }],
	[['||', ',x', ',..rest'], function(form, env, k){
		var $rest = this.rest;
		return ra(this.x, env, function(x){
			var t = env.newt();
			return ['.begin', 
				['.if', x, ['.set', t, x], re(['&', ['||'].concat($rest)], env, function(x){ return ['.set', t, x] })],
				k(t),
			]
		})
	}],
	[	['&', [_('operator', prim), ',..args']],
		[_('operator', prim), ',..args'],
		function(form, env, k){
			var $operator = this.operator, $args = this.args;
			return re$($args, env, function(x$){
				return k([$operator].concat(x$))
			})
		}],
	[	['&', [',callee', ',..args']], 
		[',callee', ',..args'], 
		function(form, env, k){
			var $args = this.args, $callee = this.callee;
			return ra($callee, env, function(x0){
				return re$($args, env, function(x$){
					return k([x0].concat(x$))
				})
			})
		}],
//	[['&', _('x', atom)], function(form, env, k){ return k(this.x) }],
//	[['&', _('x', ['.t', ',name'])], function(form, env, k){ return k(this.x) }],
	[any, function(form, env, k){ return k(form) }]
);

function ra(form, env, k){
	return re(form, env, function(x){
		if(typeof x === 'string' && x[0] === '_'){
			return k(x)
		} else {
			var t = env.newt();
			return ['.begin', ['.set', t, x], k(t)]
		}
	})
}
function re$(form, env, k){
	if(!form.length) return k([])
	return ra(form[0], env, function(x0){
		return re$(form.slice(1), env, function(x$){
			return k([x0].concat(x$))
		})
	})
}
function ret$(form, env, k){
	if(!form.length) return k([]);
	return re(form[0], env, function(x0){
		return ret$(form.slice(1), env, function(x$){
			return k([x0].concat(x$))
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
	} else if(form instanceof Array && form[0] === '.trivial') {
		return mb(form[1])
	} else if(form instanceof Array){
		return form.map(mb)
	} else {
		return form
	}
}

exports.pass = function(form, externScope){
	var globalScope = new Scope(externScope);
	return mb(rs(trivial(form), globalScope, id))
}