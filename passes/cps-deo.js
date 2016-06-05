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
var triv = require('../commons/match.js').triv;

var Scope = require('patrisika-scopes').Scope;

var keepBeginsAndEnds = require('../commons/match.js').keepBeginsAndEnds;
var FormInvalidError = require('../commons/formerror.js').FormInvalidError

function isDelaied(form) {
	return form instanceof Array && (form[0] === '.&' || form[0] === '.&!')
}

function reject(form) { throw new FormInvalidError(form, "Invalid form") };
function uniop(op) { return [op, ',x'] }
function binop(op) { return [op, ',x', ',..y'] }
function logop(op) { return [op, ',..x'] }

function RET(x) { return ['.return', x] }
function KEY(x) { return x[0] };
function VAL(x) { return x[1] };

// Optimization: Find out all trivial subforms.
// Note: this pass will reject invalid forms for several primitices
function trivial$(j0) {
	return function (form) {
		if (!j0 && prim(form[0])) process.stderr.write(require('util').inspect(form) + '\n')
		var a = form.slice(0);
		for (var j = j0; j < form.length; j++) {
			a[j] = trivial(form[j])
		}
		var delaied = false;
		var trivialForm = true;
		for (var j = j0; j < a.length; j++) {
			if (isDelaied(a[j])) {
				delaied = true
			}
			if (!(a[j] && (a[j][0] === '.trivial'))) {
				trivialForm = false;
			}
		};
		if (delaied) {
			return ['.&', a]
		} else if (trivialForm) {
			return ['.trivial', a];
		} else {
			return a;
		}
	}
}
var trivial$0 = trivial$(0);
var trivial$1 = trivial$(1);
function flatbegin(form) {
	if (form instanceof Array && form[0] === '.begin') {
		var a = form.slice(1).map(flatbegin);
		var res = [];
		for (var j = 0; j < a.length; j++) {
			if (a[j] instanceof Array && (a[j][0] === '.begin' || a[j][0] === '.seq')) {
				res = res.concat(a[j].slice(1))
			} else {
				res.push(a[j])
			}
		};
		return keepBeginsAndEnds(form, ['.begin'].concat(res));
	} else {
		return form;
	}
}
var trivial = syntax_rule(
	[['.lambda', [',..args'], ',body'], function (form) {
		return ['.trivial', ['.lambda', this.args, trivial(this.body)]]
	}],
	[['.lambda.scoped', [',..args'], ',body', ',scope'], function (form) {
		return ['.trivial', ['.lambda.scoped', this.args, trivial(this.body), this.scope]]
	}],
	[['.quote', ',x'],
		['.exotic', ',x'],
		['.t', _('id', atom)],
		['.t', _('id', atom), ',scope'],
		['.id', _('id', atom)],
		['.id', _('id', atom), ',scope'],
		['.local', _('id', atom)],
		['.unit'],
		['.thisp'],
		['.argsp'], function (form) { return ['.trivial', form] }],
	[['.yield', ',x'], function (form) { return ['.&!', trivial(this.x)] }],
	[['.beta', ',args', ',body', ',..params'], function (form) {
		var a = ['.beta', this.args];
		for (var j = 2; j < form.length; j++) {
			a[j] = trivial(form[j])
		};
		for (var j = 2; j < a.length; j++) {
			if (isDelaied(a[j])) {
				return ['.&', a];
			}
		};
		return a;
	}],
	[['.beta.scoped', ',args', ',body', ',scope', ',..params'], function (form) {
		var a = ['.beta.scoped', this.args, trivial(this.body), this.scope];
		for (var j = 4; j < form.length; j++) {
			a[j] = trivial(form[j])
		};
		if (isDelaied(a[2])) return ['.&', a]
		for (var j = 4; j < a.length; j++) {
			if (isDelaied(a[j])) {
				return ['.&', a];
			}
		};
		return a;
	}],
	[['.begin', ',a'], function (form) { return trivial(form[1]) }],
	[//['.if', ',condition', ',consequent'],
		//['.if', ',condition', ',consequent', ',alternate'],
		//['.begin', ',..args'],
		['.while', ',test', ',body'],
		['.return', ',x'],
		['.break', ',x'],
		['.throw', ',x'], function (form) {
			var a = [form[0]];
			for (var j = 1; j < form.length; j++) {
				a[j] = trivial(form[j])
			}
			for (var j = 1; j < a.length; j++) {
				if (isDelaied(a[j])) {
					return ['.&', a];
				}
			};
			return a;
		}],
	[['.try', ',block', [',param'], ',handler'], function (form) {
		var $block = trivial(this.block);
		var $handler = trivial(this.handler);
		if (isDelaied($block) || isDelaied($handler)) { return ['.&', ['.try', $block, [this.param], $handler]] }
		else { return ['.try', $block, [this.param], $handler] }
	}],
	[['.hash', ',..args'], function (form) {
		var a = ['.hash'];
		for (var j = 1; j < form.length; j++) {
			a[j] = [form[j][0], trivial(form[j][1])];
		};
		var delaied = false;
		var trivialForm = true;
		for (var j = 1; j < a.length; j++) {
			if (isDelaied(a[j][1])) {
				delaied = true
			}
			if (!(a[j][1] && (a[j][1][0] === '.trivial'))) {
				trivialForm = false;
			}
		};
		if (delaied) {
			return ['.&', a]
		} else if (trivialForm) {
			return ['.trivial', a];
		} else {
			return a;
		}
	}],
	[['.begin', ',..args'], function (form) {
		return trivial$1(flatbegin(form));
	}],
	[
		['.if', ',condition', ',consequent'],
		['.if', ',condition', ',consequent', ',alternate'],
		['.set', ',left', ',right'],
		['.new', ',callee', ',..args'],
		['.list', ',..items'],
		['.', ',left', ',right'],
		uniop('.typeof'),
		uniop('!'),
		uniop('+'),
		uniop('-'),
		binop('+'),
		binop('-'),
		binop('*'),
		binop('/'),
		binop('%'),
		binop('<'),
		binop('>'),
		binop('<='),
		binop('>='),
		binop('=='),
		binop('!='),
		binop('==='),
		binop('!=='),
		binop('=~'),
		binop('!~'),
		binop('.is'),
		logop('&&'),
		logop('||'), trivial$1],
	[[_('op', prim), ',..any'], reject],
	[[',callee', ',..args'], trivial$0],
	[atom, function (form) {
		if (/^\W/.test(form)) return form
		else return ['.trivial', form]
	}],
	[any, function (form) { return form }]
)

function id(x) { return x }

exports.pass = function (form, globals, kExit, expressionary) {
	// RS: regularize in statement environment, with return value dropped
	// k accepts regularized form, and combines it with incoming subforms.
	var rs = syntax_rule(
		// NOTE: Treatment on Return and Throw nodes are IDENTICAL to those in re.
		[['.trivial', ['.if', ',..xs']], function (form, env, k) { return rs(form[1], env, k) }],
		[['.trivial', ['.begin', ',..xs']], function (form, env, k) { return rs(form[1], env, k) }],
		[['.if', ',cond', ',consequent'], function (form, env, k) {
			var $consequent = this.consequent;
			return re(this.cond, env, function (c) {
				return k(['.if', c, rs($consequent, env, id)])
			})
		}],
		[['.if', ',cond', ',consequent', ',alternate'], function (form, env, k) {
			var $consequent = this.consequent;
			var $alternate = this.alternate;
			return re(this.cond, env, function (c) {
				return k(['.if', c, rs($consequent, env, id), rs($alternate, env, id)])
			})
		}],
		[['.while', ',cond', ',body'], function (form, env, k) {
			if (this.cond instanceof Array && this.cond[0] === '.trivial') {
				return k(['.while', this.cond[1], rs(this.body, env, id)])
			} else {
				return ra(form[1], env, function (t) {
					return k(['.while', t, rs(form[2], env, function (x) {
						return ['.begin', x, re(form[1], env, function (x) { return ['.set', t, x] })]
					})])
				})
			}
		}],
		[['.try', ',block', [',param'], ',handler'], function (form, env, k) {
			var $param = this.param;
			if (atom($param)) {
				env.declare($param);
				var param = env.use($param);
			} else {
				var param = $param;
			}

			return k(['.try', rs(this.block, env, id), [param], rs(this.handler, env, id)]);
		}],
		[['.begin', ',head', ',..rear'], function (form, env, k) {
			return rs(this.head, env, function (e) {
				var stmt = ['.begin', e, null]
				delaiedTransformations.push({
					method: rs,
					form: ['.begin'].concat(form.slice(2)),
					env: env,
					k: k,
					after: function (s) {
						stmt[2] = s;
					}
				})
				return stmt
			})
		}],
		[['.begin', ',single'], function (form, env, k) {
			return rs(this.single, env, k)
		}],
		[['.begin'], function (form, env, k) { return k(['.unit']) }],
		[any, function (form, env, k) { return re(form, env, k) }]
	);

	// RE: regularize in expression environment, keep return value.
	// `k` accepts a trivial form, often a T-variable, representing
	// the result of evaluating `form`.
	var re = syntax_rule(
		[empty, function (form, env, k) { return k(['.unit']) }],

		// Deferred nodes
		[['.&!', ',x'], function (form, env, k) {
			var t = env.newt();
			return re(this.x, env, function (x) {
				return keepBeginsAndEnds(form, ['.begin',
					['.set', env.tStep, ['.lambda', [t], k(t)]],
					['.return', ['.hash',
						['value', x],
						['done', ['.quote', false]]
					]]
				])
			})
		}],

		// Flow Controls, Deferred
		[['.&', ['.begin', ',x']], function (form, env, k) {
			return re(this.x, env, k)
		}],
		[['.&', ['.begin', ',x', ',..rest']], function (form, env, k) {
			var $rest = this.rest;
			return ra(this.x, env, function (x) {
				return re(['.&', ['.begin'].concat($rest)], env, function (v) {
					return k(v);
				})
			})
		}],
		[['.&', ['.if', ',test', ',consequent']], function (form, env, k) {
			return re(['.&', ['.if', this.test, this.consequent, ['.unit']]], env, k)
		}],
		[['.&', ['.if', ',test', ',consequent', ',alternate']], function (form, env, k) {
			var $test = this.test, $consequent = this.consequent, $alternate = this.alternate;
			var t = env.newt();
			var tx = env.newt();
			return ['.begin',
				['.set', t, ['.lambda', [tx], k(tx)]],
				ra($test, env, function (c) {
					return ['.if', c,
						re($consequent, env, function (x) { return ['.return', [t, x]] }),
						re($alternate, env, function (x) { return ['.return', [t, x]] })
					];
				})
			];
		}],
		[['.&', ['.while', ',test', ',body']], function (form, env, k) {
			var $test = this.test, $body = this.body;
			var t = env.newt();
			var tr = env.newt();
			var tx = env.newt();
			var trx = env.newt();
			return ['.begin',
				['.set', t, ['.lambda', [tx], k(tx)]],
				['.set', tr, ['.lambda', [trx], ra($test, env, function (c) {
					return ['.if', c,
						re($body, env, function (x) { return ['.return', [tr, x]] }),
						['.return', [t, trx]]
					];
				})]],
				['.return', [tr]]
			];
		}],
		[['.&', ['.try', ',block', [',param'], ',handler']], function (form, env, k) {
			var $block = this.block, $param = this.param, $handler = this.handler;
			if (atom($param)) {
				env.declare($param);
				var param = env.use($param);
			} else {
				var param = $param;
			}
			var t = env.newt(), tx = env.newt(), te = env.newt();
			var b = env.newt();
			return ['.begin',
				['.set', t, ['.lambda', [tx],
					['.begin', ['.set', env.tCatch, b], k(tx)]]],
				['.set', b, env.tCatch],
				['.set', env.tStep, ['.lambda', [], re($block, env, function (x) { return ['.return', [t, x]] })]],
				['.set', env.tCatch, ['.lambda', [te], ['.begin',
					['.set', param, te],
					['.set', env.tCatch, b],
					re($handler, env, function (x) {
						return ['.return', [t, x]]
					})
				]]],
				['.return', [env.tNext]]
			]
		}],
		[['.&', ['.return', ',x']], ['.return', ',x'], function (form, env, k) {
			return re(this.x, env, env.exitK)
		}],
		[['.&', ['.break', ',x']], ['.break', ',x'], function (form, env, k) {
			return re(this.x, env, env.normalExitK || env.exitK)
		}],
		[['.&', ['.throw', ',x']], ['.throw', ',x'], function (form, env, k) {
			if (env.isGenerator) {
				return re(this.x, env, function (x) { return ['.return', [env.tCatch, x]] })
			} else {
				return re(this.x, env, function (x) { return ['.throw', x] })
			}
		}],

		// Flow controls, Plain
		[['.begin'], function (form, env, k) { return k(['.unit']) }],
		[['.begin', ',x'], function (form, env, k) { return re(this.x, env, k) }],
		[['.begin', ',x', ',..rest'], function (form, env, k) {
			var $x = this.x, $rest = this.rest;
			return rs($x, env, function (s) {
				var stmt = keepBeginsAndEnds(form, ['.begin', s, null]);
				delaiedTransformations.push({
					method: re,
					form: ['.begin'].concat($rest),
					env: env,
					k: k,
					after: function (s) {
						stmt[2] = s;
					}
				});
				return stmt
			})
		}],
		[['.if', ',cond', ',consequent'], function (form, env, k) {
			var $consequent = this.consequent;
			return re(this.cond, env, function (c) {
				var t = env.newt();
				if (k === RET) {
					return keepBeginsAndEnds(form, ['.if', c, re($consequent, env, k), k(['.unit'])])
				} else {
					return keepBeginsAndEnds(form, ['.begin', ['.if', c, re($consequent, env, function (x) { return ['.set', t, x] })], k(t)])
				}
			});
		}],
		[['.if', ',cond', ',consequent', ',alternate'], function (form, env, k) {
			var $consequent = this.consequent;
			var $alternate = this.alternate;
			return re(this.cond, env, function (c) {
				var t = env.newt();
				if (k === RET) {
					return keepBeginsAndEnds(form, ['.if', c, re($consequent, env, k), re($alternate, env, k)])
				} else {
					return ['.begin', keepBeginsAndEnds(form, ['.if', c,
						re($consequent, env, function (x) { return ['.set', t, x] }),
						re($alternate, env, function (x) { return ['.set', t, x] })
					]), k(t)]
				}
			});
		}],
		[['.while', ',cond', ',body'], function (form, env, k) {
			var $cond = this.cond;
			var $body = this.body;
			return ra($cond, env, function (c) {
				var t = env.newt();
				return ['.begin', keepBeginsAndEnds(form, ['.while', c, re($body, env, function (x) {
					return ['.begin', ['.set', t, x], re($cond, env, function (x) { return ['.set', c, x] })]
				})]), k(t)]
			});
		}],
		[['.try', ',block', [',param'], ',handler'], function (form, env, k) {
			var $block = this.block;
			var $param = this.param;
			var $handler = this.handler;
			if (atom($param)) {
				env.declare($param);
				var param = env.use($param);
			} else {
				var param = $param;
			}
			var t = env.newt();
			return ['.begin', keepBeginsAndEnds(form, ['.try',
				re($block, env, function (x) { return ['.set', t, x] }),
				[param],
				re($handler, env, function (x) { return ['.set', t, x] })
			]), k(t)];
		}],
		// Lambdas are pretty trivial
		// We delay their actual tranasformations and transform them later
		// to avoid stack overflow.
		// (you know, there are a lot of recursions in this pass)
		[['.trivial', ['.lambda.scoped', [',..args'], ',body', ',scope']],
			['.lambda.scoped', [',..args'], ',body', ',scope'],
			function (form, env, k) {
				var derived = this.scope; derived.semiparent = env;
				var args = this.args.map(function (arg) {
					if (atom(arg)) derived.declare(arg, true);
					return re(arg, derived, id)
				});
				var b = this.body;
				while (b instanceof Array && b[0] === '.trivial' && b[1] instanceof Array && (b[1][0] === '.begin' || b[1][0] === '.trivial')) {
					b = b[1];
				};
				var selfid = env.newt();
				if (isDelaied(b)) {
					derived.isGenerator = true;
					derived.tStep = derived.newt();
					derived.tNext = derived.newt();
					derived.tCatch = derived.newt();
					derived.tRetp = derived.newt();
					derived.tDerivFn = derived.newt();
					derived.exitK = function (x) {
						return ['.begin',
							['.set', derived.tStep, ['.lambda', [], ['.throw', ['.quote', 'Iteration Stopped']]]],
							['.return', ['.hash',
								['done', ['.quote', true]],
								['value', x]]]]
					};
				} else {
					derived.exitK = RET;
				};
				derived.thisBindStatement = ['.unit'];
				derived.argsBindStatement = ['.unit'];
				derived.tThis = derived.newt();
				derived.tArgs = derived.newt();
				var body = commitTransform(re, b, derived, derived.exitK);
				body = ['.begin', derived.thisBindStatement, derived.argsBindStatement, body];
				if (derived.isGenerator) {
					return k(keepBeginsAndEnds(form, ['.lambda.scoped', args, ['.begin',
						['.set', derived.tStep, ['.lambda', [], body]],
						['.set', derived.tNext, ['.lambda', ['x'], ['.try', ['.return', [derived.tStep, 'x']], ['ex'], ['.return', [derived.tCatch, 'ex']]]]],
						['.set', derived.tCatch, ['.lambda', ['e'], ['.throw', 'e']]],
						['.if', ['.is', ['.thisp'], selfid], ['.set', derived.tRetp, ['.thisp']], ['.begin',
							['.set', derived.tDerivFn, ['.lambda', [], ['.unit']]],
							['.set', ['.', derived.tDerivFn, ['.quote', 'prototype']], ['.', selfid, ['.quote', 'prototype']]],
							['.set', derived.tRetp, ['.new', derived.tDerivFn]]]],
						['.set', ['.', derived.tRetp, ['.', globals.use('Symbol'), ['.quote', 'iterator']]], ['.lambda', [], ['.return', derived.tRetp]]],
						['.set', ['.', derived.tRetp, ['.quote', 'next']], derived.tNext],
						['.set', ['.', derived.tRetp, ['.quote', 'throw']], ['.lambda', ['x'], ['.return', [derived.tCatch, 'x']]]],
						['.return', derived.tRetp]
					], derived, selfid]))
				} else {
					return k(keepBeginsAndEnds(form, ['.lambda.scoped', this.args, body, derived, selfid]))
				}
			}],
		[['.trivial', ['.lambda', [',..args'], ',body']],
			['.lambda', [',..args'], ',body'], function (form, env, k) { return re(['.lambda.scoped', this.args, this.body, new Scope(null, env)], env, k) }],

		// Beta redexes, Deffered
		[['.&', ['.beta', [',..args'], ',body', ',..params']], function (form, env, k) {
			return re(['.&', ['.beta.scoped', this.args, this.body, new Scope(null, env)].concat(this.params)])
		}],
		[['.&', ['.beta.scoped', ',args', ',body', ',scope', ',..params']], function (form, env, k) {
			var $params = this.params, $body = this.body, $args = this.args;
			if (!isDelaied($body)) return re(['.beta.scoped', $args, $body, this.scope].concat($params), env, k);
			var derived = this.scope; derived.semiparent = env;
			return re$($params, env, function (params) {
				// Body is delaied
				if (!env.tThis) env.tThis = env.newt(); derived.tThis = env.tThis;
				if (!env.tArgs) env.tArgs = env.newt(); derived.tArgs = env.tArgs;
				derived.thisBindStatement = env.thisBindStatement;
				derived.argsBindStatement = env.argsBindStatement;
				derived.isGenerator = true;
				derived.tStep = env.tStep;
				derived.tNext = env.tNext;
				derived.tCatch = env.tCatch;
				var args = $args.map(function (arg) {
					if (atom(arg)) derived.declare(arg, true);
					return re(arg, derived, id)
				});
				var tExit = derived.newt();
				var tx = derived.newt();
				derived.exitK = function (x) { return ['.return', [tExit, x]] };
				derived.normalExitK = function (x) { return ['.return', [tNorm, x]] };
				var tNorm = derived.newt();
				var tnx = derived.newt();

				return ['.return', keepBeginsAndEnds(form, [['.lambda.scoped', args, ['.begin',
					['.set', tExit, ['.lambda', [tx], env.exitK(tx)]],
					['.set', tNorm, ['.lambda', [tnx], k(tnx)]],
					['.set', derived.tStep, ['.lambda', [], commitTransform(re, $body, derived, derived.normalExitK)]],
					['.return', [derived.tNext]]
				], derived]].concat(params))]
			})
		}],
		// Beta redexes : Plain
		[['.beta', [',..args'], ',body', ',..params'], function (form, env, k) {
			return re(['.beta.scoped', this.args, this.body, new Scope(null, env)].concat(this.params), env, k)
		}],
		[['.beta.scoped', [',..args'], ',body', ',scope', ',..params'], function (form, env, k) {
			// Note: .beta is designed for [let] construction in most functional
			// languages. It does NOT change the semantics of [return]. Therefore
			// we need a tagging system to ensure that normal exit differs from
			// returning.
			var $params = this.params, $body = this.body, $args = this.args;
			var derived = this.scope; derived.semiparent = env;
			while ($body instanceof Array && $body[0] === '.trivial' && $body[1] instanceof Array && ($body[1][0] === '.begin' || $body[1][0] === '.trivial')) {
				$body = $body[1];
			};
			return re$($params, env, function (params) {
				// always generates tThis and tArgs
				if (!env.tThis) env.tThis = env.newt(); derived.tThis = env.tThis;
				if (!env.tArgs) env.tArgs = env.newt(); derived.tArgs = env.tArgs;
				derived.thisBindStatement = env.thisBindStatement;
				derived.argsBindStatement = env.argsBindStatement;
				var args = $args.map(function (arg) {
					if (atom(arg)) derived.declare(arg, true);
					return re(arg, derived, id)
				});
				var returnUsed = false;
				derived.exitK = function (x) {
					returnUsed = true;
					return ['.begin',
						['.set', tag, ['.quote', true]],
						['.set', t, x],
						['.return', t]
					]
				};
				derived.normalExitK = function (x) {
					var retex = ['.return', ['.set', t, x]];
					normalExitReturns.push(retex);
					return retex;
				};
				var t = env.newt();
				var tag = env.newt('tag');

				var normalExitReturns = [];

				var b = commitTransform(re, $body, derived, derived.normalExitK);
				var main = keepBeginsAndEnds(form, [['.lambda.scoped', args, b, derived]].concat(params));
				if (returnUsed) {
					return ['.begin',
						['.set', tag, ['.quote', false]],
						main,
						['.if', tag, env.exitK(t), k(t)]
					]
				} else {
					for (var j = 0; j < normalExitReturns.length; j++) {
						normalExitReturns[j][1] = normalExitReturns[j][1][2]
					}
					return (k(main))
				}
			})
		}],

		// Primitives (trivial and non-trivial)
		[['.trivial', _('x', atom)], ('x', atom),
			function (form, env, k) {
				return k(keepBeginsAndEnds(form, env.use(this.x)))
			}],
		[['.trivial', ['.quote', ',x']], ['.quote', ',x'],
			['.trivial', ['.id', ',..x']], ['.id', ',..x'],
			['.trivial', ['.t', ',..x']], ['.t', ',..x'],
			['.trivial', ['.exotic', ',..x'], ['.exotic', ',..x']],
			function (form, env, k) { return k(form) }],
		[['.trivial', ['.local', ['.trivial', _('x', atom)]]], ['.local', ['.trivial', _('x', atom)]],
			['.trivial', ['.local', _('x', atom)]], ['.local', _('x', atom)],
			function (form, env, k) {
				env.declare(this.x);
				return k(keepBeginsAndEnds(form, env.use(this.x)))
			}],
		[['.trivial', ['.thisp']], ['.thisp'],
			function (form, env, k) {
				if (!env.tThis) env.tThis = env.newt();
				env.thisBindStatement[0] = '.set';
				env.thisBindStatement[1] = env.tThis;
				env.thisBindStatement[2] = ['.thisp'];
				return k(env.tThis)
			}],
		[['.trivial', ['.argsp']], ['.argsp'],
			function (form, env, k) {
				if (!env.tArgs) env.tArgs = env.newt();
				env.argsBindStatement[0] = '.set';
				env.argsBindStatement[1] = env.tArgs;
				env.argsBindStatement[2] = ['.argsp'];
				return k(env.tArgs)
			}],
		[['.trivial', ['.unit']], ['.unit'],
			function (form, env, k) { return k(form) }],

		// Trivial expressions
		[['.trivial', ['.hash', ',..pairs']],
			function (form, env, k) {
				var $keys = this.pairs.map(KEY);
				var $values = this.pairs.map(VAL);
				return ret$($values, env, function (x$) {
					var a = [];
					for (var j = 0; j < $keys.length; j++) {
						a[j] = [$keys[j], x$[j]]
					};
					return k(keepBeginsAndEnds(form, ['.hash'].concat(a)))
				})
			}],
		[['.trivial', ['.begin']], function (form, env, k) { return k(['.unit']) }],
		[['.trivial', ['.begin', ',x']], function (form, env, k) { return re(this.x, env, k) }],
		[['.trivial', ['.begin', ',..xs']], function (form, env, k) {
			var $xs = this.xs;
			return retd$($xs, env, function (xs) {
				return k(keepBeginsAndEnds(form, ['.seq'].concat(xs)))
			})
		}],
		[['.trivial', ['.if', ',condition', ',consequent']], function (form, env, k) {
			var $condition = this.condition, $consequent = this.consequent;
			return re($condition, env, function (c) {
				return re($consequent, env, function (co) {
					return k(keepBeginsAndEnds(form, ['.conditional', c, co, ['.unit']]))
				})
			})
		}],
		[['.trivial', ['.if', ',condition', ',consequent', ',alternate']], function (form, env, k) {
			var $condition = this.condition, $consequent = this.consequent, $alternate = this.alternate;
			return re($condition, env, function (c) {
				return re($consequent, env, function (co) {
					return re($alternate, env, function (a) {
						return k(keepBeginsAndEnds(form, ['.conditional', c, co, a]))
					})
				})
			})
		}],
		[['.trivial', [_('operator', prim), ',..args']], function (form, env, k) {
			var $operator = this.operator, $args = this.args;
			return ret$($args, env, function (args) {
				return k(keepBeginsAndEnds(form, [$operator].concat(args)))
			})
		}],
		[['.trivial', [',callee', ',..args']], function (form, env, k) {
			var $callee = this.callee, $args = this.args;
			return re($callee, env, function (callee) {
				return ret$($args, env, function (args) {
					return k(keepBeginsAndEnds(form, [callee].concat(args)))
				})
			})
		}],

		[['.trivial', ',x'], function (form, env, k) { return k(this.x) }],

		// Other Expressions
		[['.&', ['.set', ['.&', ['.', ',obj', ',field']], ',right']],
			['.&', ['.set', ['.trivial', ['.', ',obj', ',field']], ',right']],
			['.&', ['.set', ['.', ',obj', ',field'], ',right']],
			['.set', ['.', ',obj', ',field'], ',right'],
			['.set', ['.trivial', ['.', ',obj', ',field']], ',right'],
			function (form, env, k) {
				var $obj = this.obj, $field = this.field, $right = this.right;
				return ra($obj, env, function (xl) {
					return ra($field, env, function (xr) {
						return re($right, env, function (r) {
							return k(keepBeginsAndEnds(form, ['.set', ['.', xl, xr], r]))
						})
					})
				})
			}],
		[['.&', ['.set', ['.trivial', ',left'], ',right']],
			['.&', ['.set', ',left', ',right']],
			['.set', ['.trivial', ',left'], ',right'],
			['.set', ',left', ',right'],
			function (form, env, k) {
				var $left = this.left, $right = this.right;
				return re($right, env, function (e) {
					return k(keepBeginsAndEnds(form, ['.set', re($left, env, id), e]))
				})
			}],
		[['.&', [['.', ',left', ',right'], ',..args']],
			['.&', [['.trivial', ['.', ',left', ',right']], ',..args']],
			['.&', [['.&', ['.', ',left', ',right']], ',..args']],
			[['.', ',left', ',right'], ',..args'],
			[['.trivial', ['.', ',left', ',right']], ',..args'],
			function (form, env, k) {
				var $left = this.left, $right = this.right, $args = this.args;
				return ra($left, env, function (xl) {
					return re($right, env, function (xr) {
						var t = env.newt();
						return ['.begin', ['.set', t, ['.', xl, xr]], re$($args, env, function (x$) {
							if (x$) return k(keepBeginsAndEnds(form, [['.', t, ['.quote', 'call']], xl].concat(x$)));
							else return k(keepBeginsAndEnds(form, [['.', t, ['.quote', 'call']], xl]));
						})]
					})
				})
			}],
		[['.&', ['.hash', ',..pairs']],
			['.hash', ',..pairs'],
			function (form, env, k) {
				var $keys = this.pairs.map(KEY);
				var $values = this.pairs.map(VAL);
				return re$($values, env, function (x$) {
					var a = [];
					for (var j = 0; j < $keys.length; j++) {
						a[j] = [$keys[j], x$[j]]
					};
					return k(keepBeginsAndEnds(form, ['.hash'].concat(a)));
				})
			}],
		[['.&', ['&&']], function (form, env, k) { return k(['.quote', true]) }],
		[['.&', ['&&', ',x']], function (form, env, k) { return re(this.x, env, k) }],
		[['.&', ['&&', ',x', ',..rest']], function (form, env, k) {
			var $rest = this.rest;
			return ra(this.x, env, function (x) {
				var t = env.newt();
				var tx = env.newt();
				return ['.begin',
					['.set', t, ['.lambda', [tx], k(tx)]],
					['.if', x, re(['.&', ['&&'].concat($rest)], env, function (x) { return ['.return', [t, x]] }), ['.return', [t, x]]]
				]
			})
		}],
		[['.&', ['||']], function (form, env, k) { return k(['.quote', false]) }],
		[['.&', ['||', ',x']], function (form, env, k) { return re(this.x, env, k) }],
		[['.&', ['||', ',x', ',..rest']], function (form, env, k) {
			var $rest = this.rest;
			return ra(this.x, env, function (x) {
				var t = env.newt();
				var tx = env.newt();
				return ['.begin',
					['.set', t, ['.lambda', [tx], k(tx)]],
					['.if', x, ['.return', [t, x]], re(['.&', ['||'].concat($rest)], env, function (x) { return ['.return', [t, x]] })]
				]
			})
		}],
		[['&&'], function (form, env, k) { return k(['.quote', true]) }],
		[['&&', ',x'], function (form, env, k) { return re(this.x, env, k) }],
		[['&&', ',x', ',..rest'], function (form, env, k) {
			var $rest = this.rest;
			return ra(this.x, env, function (x) {
				var t = env.newt();
				return ['.begin',
					['.if', x, re(['.&', ['&&'].concat($rest)], env, function (x) { return ['.set', t, x] }), ['.set', t, x]],
					k(t)
				]
			})
		}],
		[['||'], function (form, env, k) { return k(['.quote', false]) }],
		[['||', ',x'], function (form, env, k) { return re(this.x, env, k) }],
		[['||', ',x', ',..rest'], function (form, env, k) {
			var $rest = this.rest;
			return ra(this.x, env, function (x) {
				var t = env.newt();
				return ['.begin',
					['.if', x, ['.set', t, x], re(['.&', ['||'].concat($rest)], env, function (x) { return ['.set', t, x] })],
					k(t),
				]
			})
		}],
		[['.&', [_('operator', prim), ',..args']],
			[_('operator', prim), ',..args'],
			function (form, env, k) {
				var $operator = this.operator, $args = this.args;
				return re$($args, env, function (x$) {
					return k(keepBeginsAndEnds(form, [$operator].concat(x$)))
				})
			}],
		[['.&', [',callee', ',..args']],
			[',callee', ',..args'],
			function (form, env, k) {
				var $args = this.args, $callee = this.callee;
				return ra($callee, env, function (x0) {
					return re$($args, env, function (x$) {
						return k(keepBeginsAndEnds(form, [x0].concat(x$)))
					})
				})
			}],
		[any, function (form, env, k) { return k(form) }]);

	function ra(form, env, k) {
		return re(form, env, function (x) {
			if (x instanceof Array && (x[0] === '.t' || x[0] === '.trivial' && x[1] instanceof Array && x[1][0] === '.t')) {
				return k(x)
			} else {
				var t = env.newt();
				return ['.begin', ['.set', t, x], k(t)]
			}
		});
	}
	function re$(form, env, k) {
		if (!form.length) return k([])
		return ra(form[0], env, function (x0) {
			return re$(form.slice(1), env, function (x$) {
				return k([x0].concat(x$))
			})
		});
	}
	function retd(form, env, k) {
		var f = ['.trivial', null];
		delaiedTransformations.push({
			method: re,
			form: form,
			env: env,
			k: k,
			after: function (s) { f[1] = s }
		})
		return f;
	}
	function ret$(form, env, k) {
		if (!form.length) return k([]);
		return re(form[0], env, function (x0) {
			return ret$(form.slice(1), env, function (x$) {
				return k([x0].concat(x$))
			});
		});
	}
	function retd$(form, env, k) {
		if (!form.length) return k([]);
		return retd(form[0], env, function (x0) {
			return retd$(form.slice(1), env, function (x$) {
				return k([x0].concat(x$))
			});
		});
	}

	function mb(form) {
		if (form instanceof Array && form[0] === '.begin') {
			var a = form.slice(1).map(mb);
			var res = [];
			for (var j = 0; j < a.length; j++) {
				if (a[j] instanceof Array && (a[j][0] === '.begin' || a[j][0] === '.seq')) {
					res = res.concat(a[j].slice(1))
				} else {
					res.push(a[j])
				}
			};
			res = res.filter(function (x) { return !triv(x) })
			return keepBeginsAndEnds(form, ['.begin'].concat(res));
		} else if (form instanceof Array && form[0] === '.decide') {
			if (form[1]()) { return mb(form[2]()) } else { return mb(form[3]()) }
		} else if (form instanceof Array && form[0] === '.seq') {
			var a = form.slice(1).map(mb);
			var res = [];
			for (var j = 0; j < a.length; j++) {
				if (a[j] instanceof Array && a[j][0] === '.seq') {
					res = res.concat(a[j].slice(1))
				} else {
					res.push(a[j])
				}
			};
			res = res.slice(0, -1).filter(function (x) { return !triv(x) }).concat([res[res.length - 1]])
			if (res.length === 0) return ['.unit']
			else if (res.length === 1) return res[0]
			else return keepBeginsAndEnds(form, ['.seq'].concat(res));
		} else if (form instanceof Array && form[0] === '.trivial') {
			return keepBeginsAndEnds(form, mb(form[1]))
		} else if (form instanceof Array) {
			return keepBeginsAndEnds(form, form.map(mb))
		} else {
			return form
		}
	}

	globals.exitK = kExit || id;

	// I found that this pass produces a lot of recursions
	// so this array records delaied transformations
	// In Patrisika, everything returned by a `re` or `k` 
	// are always preserved without modification.
	// This feature makes the delay possible.
	var delaiedTransformations = [];
	var tf = trivial(form);

	function commitTransform(transformer, form, env, k) {
		var _dt = delaiedTransformations;
		delaiedTransformations = [];
		var transformed = transformer(form, env, k);
		var nRolls = 0;
		while (delaiedTransformations.length) {
			var todos = delaiedTransformations;
			delaiedTransformations = [];
			for (var j = 0; j < todos.length; j++) {
				(todos[j].after || id)(todos[j].method(todos[j].form, todos[j].env, todos[j].k))
			};
			nRolls += 1;
		};
		delaiedTransformations = _dt;
		return transformed;
	};

	return mb(commitTransform(expressionary ? ra : rs, tf, globals, globals.exitK));
}