// PATRISIKA: Code Generation
// In this pass we translate regularized Patrisika AST into SpiderMonkey AST.

var syntax_rule = require('../commons/match.js').syntax_rule;
var _ = require('../commons/match.js')._;
var atom = require('../commons/match.js').atom;
var empty = require('../commons/match.js').empty;
var any = require('../commons/match.js').any;
var ref = require('../commons/match.js').ref;

var resolveIdentifier = require('patrisika-scopes').resolveIdentifier
var resolveTemp = require('patrisika-scopes').resolveTemp

var FormInvalidError = require('../commons/formerror.js').FormInvalidError

exports.pass = function (form, globals, lcmap) {
	var lastNode;

	if (!lcmap) var syntax_rule_withLoc = syntax_rule;
	else var syntax_rule_withLoc = function () {
		var fn = syntax_rule.apply(this, arguments);
		return function (node) {
			var t = lastNode;
			if (node && node.begins >= 0 && node.ends >= 0) lastNode = node;
			var res = fn.apply(this, arguments);
			if (node && node.begins >= 0 && node.ends >= 0) {
				res.loc = {
					start: { line: lcmap.line[node.begins], column: lcmap.column[node.begins] },
					end: { line: lcmap.line[node.ends], column: lcmap.column[node.ends] }
				}
			};
			lastNode = t;
			return res;
		}
	};

	var holdingTasks = [];
	var resolutionCache = [];
	var constantOverrides = [];
	function tb(form) {
		var s = ts(form);
		if (s.type !== 'BlockStatement') {
			return {
				type: 'BlockStatement',
				body: [s]
			}
		};
		return s;
	}
	var ts = syntax_rule_withLoc(

		[['.begin', ',..statements'], function (form) {
			return {
				type: 'BlockStatement',
				body: this.statements.map(ts)
			}
		}],
		[['.if', ',condition', ',consequent', ',alternate'], function (form) {
			return {
				type: 'IfStatement',
				test: te(this.condition),
				consequent: ts(this.consequent),
				alternate: ts(this.alternate)
			}
		}],
		[['.if', ',condition', ',consequent'], function (form) {
			return {
				type: 'IfStatement',
				test: te(this.condition),
				consequent: ts(this.consequent),
				alternate: null
			}
		}],
		[['.while', ',test', ',body'], function (form) {
			var test = te(this.test);
			var body = ts(this.body);
			var update = null;
			if (body.type === 'BlockStatement' && body.body.length > 1 && body.body[body.body.length - 1] && body.body[body.body.length - 1].type === 'ExpressionStatement') {
				update = body.body.pop().expression
			}
			return {
				type: 'ForStatement',
				init: null,
				test: test,
				update: update,
				body: body
			}
		}],
		[['.try', ',block', [',param'], ',handler'], function (form) {
			return {
				type: 'TryStatement',
				block: tb(this.block),
				handlers: [{
					type: 'CatchClause',
					param: te(this.param),
					body: tb(this.handler)
				}]
			}
		}],
		[['.return', ',argument'], function (form) {
			return {
				type: 'ReturnStatement',
				argument: te(this.argument)
			}
		}],
		[['.throw', ',argument'], function (form) {
			return {
				type: 'ThrowStatement',
				argument: te(this.argument)
			}
		}],
		[any, function (form) {
			return {
				type: 'ExpressionStatement',
				expression: te(form)
			}
		}]
	);

	function Binopoid(spiderMonkeyNodeType) {
		return function (operator, jsOperator) {
			return [[operator, ',..items'], function () {
				if (this.items.length > 1) {
					return this.items.slice(1).reduce(function (left, right) {
						return {
							type: spiderMonkeyNodeType,
							left: left,
							right: te(right),
							operator: jsOperator || operator
						}
					}, te(this.items[0]));
				} else {
					return te(this.items[0])
				}
			}]
		}
	};
	var binop = Binopoid('BinaryExpression');
	var logop = Binopoid('LogicalExpression');

	var uniop = function (operator, jsOperator) {
		return [[operator, ',argument'], function () {
			return {
				type: "UnaryExpression",
				operator: jsOperator || operator,
				prefix: true,
				argument: te(this.argument)
			}
		}]
	}

	var te = syntax_rule_withLoc(
		[['.lambda', ',args', ',body'], function (form) {
			var blank = {}, t = this;
			holdingTasks.push(function () {
				blank.type = 'FunctionExpression';
				blank.params = t.args.map(te);
				blank.body = tb(t.body);
				blank.expression = false;
				blank.generator = false;
				return blank
			});
			return blank;
		}],
		[['.lambda.scoped', ',args', ',body', ',scope'], function (form) {
			var blank = {}, t = this;
			holdingTasks.push(function () {
				var params = t.args.map(te)
				var body = tb(t.body);
				var s = t.scope;
				var cacheMatch = resolutionCache[s._N];
				if (cacheMatch) {
					var locals = cacheMatch.locals.map(function (id) {
						return {
							type: "VariableDeclarator",
							id: { type: "Identifier", name: s.castName(id) },
							init: null
						}
					});
				} else {
					var locals = [];
				}

				locals = locals.concat(s.temps.map(function (id) {
					return {
						type: "VariableDeclarator",
						id: { type: "Identifier", name: resolveTemp(id, s, resolutionCache, isStrict) },
						init: null
					}
				}));
				if (cacheMatch) for (var j = 0; j < cacheMatch.hangingSubscopes.length; j++) {
					var hss = cacheMatch.hangingSubscopes[j];
					if (resolutionCache[hss._N]) {
						locals = locals.concat(resolutionCache[hss._N].locals.map(function (id) {
							return {
								type: "VariableDeclarator",
								id: { type: "Identifier", name: hss.castName(id) },
								init: null
							}
						}), hss.temps.map(function (id) {
							return {
								type: "VariableDeclarator",
								id: { type: "Identifier", name: resolveTemp(id, hss, resolutionCache, isStrict) },
								init: null
							}
						}))
					}
				};

				// dehoist
				var localHash = {};
				for (var j = 0; j < locals.length; j++) {
					localHash[locals[j].id.name] = true;
				};
				for (var j = 0; j < params.length; j++) {
					localHash[params[j].name] = false;
				};
				for (var j = 0; j < body.body.length; j++) if (body.body[j].type === 'ExpressionStatement'
					&& body.body[j].expression.type === 'AssignmentExpression'
					&& body.body[j].expression.left.type === 'Identifier'
					&& localHash[body.body[j].expression.left.name] === true) {
					localHash[body.body[j].expression.left.name] = false;
					body.body[j] = {
						type: "VariableDeclaration",
						kind: 'var',
						declarations: [{
							type: "VariableDeclarator",
							id: body.body[j].expression.left,
							init: body.body[j].expression.right
						}]
					};
				};
				locals = locals.filter(function (d) {
					return (localHash[d.id.name] === true)
				});
				if (locals.length) {
					body.body.unshift({
						type: "VariableDeclaration",
						kind: "var",
						declarations: locals
					});
				};
				blank.type = 'FunctionExpression';
				blank.params = params;
				blank.body = body;
				blank.expression = false;
				blank.generator = false;
				return blank
			});
			return blank;

		}],
		[['.lambda.scoped', ',args', ',body', ',scope', ',id'], function (form) {
			var e = te(form.slice(0, -1));
			e.id = te(this.id);
			return e;
		}],
		[['.conditional', ',condition', ',consequent', ',alternate'], function (form) {
			return {
				type: 'ConditionalExpression',
				test: te(this.condition),
				consequent: te(this.consequent),
				alternate: te(this.alternate)
			}
		}],
		[['.seq', ',..xs'], function (form) {
			return {
				type: 'SequenceExpression',
				expressions: this.xs.map(te)
			}
		}],
		[['.t', ',id'], function (form) { return { type: 'Identifier', name: this.id } }],
		[['.t', ',id', ',scope'], function (form) { return { type: 'Identifier', name: resolveTemp(this.id, this.scope, resolutionCache, isStrict) } }],
		[['.id', ',id', ',scope'], function (form) {
			var match = resolveIdentifier(this.id, this.scope, resolutionCache, isStrict);
			var name = match.belongs.castName(this.id);
			if (isStrict && resolutionCache.undeclareds && resolutionCache.undeclareds.has(this.id)) {
				var entries = resolutionCache.undeclareds.get(this.id);
				for (var j = 0; j < entries.length; j++) if (entries[j].belongs === this.scope && !entries[j].firstUse) {
					entries[j].firstUse = lastNode
				}
			}
			return { type: 'Identifier', name: name }
		}],
		[['.', ',left', ',right'], function (form) {
			var l = te(this.left);
			var r = te(this.right);
			if (r.type === 'Literal' && typeof r.value === 'string' && /^[a-zA-Z]\w*$/.test(r.value)) {
				return {
					type: 'MemberExpression',
					object: l,
					property: { type: 'Identifier', name: r.value },
					computed: false
				}
			} else {
				return {
					type: 'MemberExpression',
					object: l,
					property: r,
					computed: true
				}
			}
		}],
		[['.quote', ',val'], function (form) {
			if (this.val === undefined) return { type: 'UnaryExpression', operator: 'void', prefix: true, argument: { type: 'Literal', value: 0 } }
			else if (typeof this.val === "number" && this.val < 0) return { type: "UnaryExpression", operator: '-', prefix: true, argument: { type: "Literal", value: -this.val } }
			else return { type: 'Literal', value: this.val }
		}],
		[['.unit'], function (form) {
			return { type: 'UnaryExpression', operator: 'void', prefix: true, argument: { type: 'Literal', value: 0 } }
		}],
		[['.thisp'], function (form) {
			return { type: 'ThisExpression' }
		}],
		[['.argsp'], function (form) {
			return { type: 'Identifier', name: 'arguments' }
		}],
		uniop('.typeof', 'typeof'),
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
		binop('==', '==='),
		binop('!=', '!=='),
		binop('===', '==='),
		binop('!==', '!=='),
		binop('=~', '=='),
		binop('!~', '!='),
		binop('.is', 'instanceof'),
		logop('&&'),
		logop('||'),
		[['.set', ['.id', ',id', ',scope'], ',right'], function (form) {
			var match = resolveIdentifier(this.id, this.scope, resolutionCache, isStrict);
			var record = match.belongs.declarations.get(this.id);
			if (record && record.isParameter) {
				if (!record.assignmentsUsed) record.assignmentsUsed = 0;
				record.assignmentsUsed += 1;
				if (record.isParameter - 0 <= record.assignmentsUsed) {
					constantOverrides.push([this.id, lastNode]);
				}
			}
			return {
				type: 'AssignmentExpression',
				left: te(['.id', this.id, this.scope]),
				right: te(this.right),
				operator: '='
			}
		}],
		[['.set', ',left', ',right'], function (form) {
			return {
				type: 'AssignmentExpression',
				left: te(this.left),
				right: te(this.right),
				operator: '='
			}
		}],
		[['.hash', ',..pairs'], function (form) {
			return {
				type: 'ObjectExpression',
				properties: this.pairs.map(function (pair) {
					return {
						key: { type: 'Literal', value: pair[0] },
						value: te(pair[1]),
						kind: 'init'
					}
				})
			}
		}],
		[['.list', ',..args'], function (form) {
			return {
				type: "ArrayExpression",
				elements: this.args.map(te)
			}
		}],
		[['.new', ',callee', ',..args'], function (form) {
			return {
				type: "NewExpression",
				callee: te(this.callee),
				arguments: this.args.map(te)
			}
		}],
		[['.exotic', ',ast'], function (form) { return form[1] }],
		[[',callee', ',..args'], function (form) {
			return {
				type: 'CallExpression',
				callee: te(this.callee),
				arguments: this.args.map(te)
			}
		}],
		[atom, function (form) { return { type: 'Identifier', name: form } }],
		[any, function (form) {
			throw new FormInvalidError(form, "Unknown Node Type")
		}]
	);

	var isStrict = false;
	if (globals.options && globals.options.strict) isStrict = true;
	var s = te(['.lambda.scoped', [], form, globals]);
	while (holdingTasks.length) {
		holdingTasks.shift()();
	};
	if (isStrict && (resolutionCache.undeclareds || constantOverrides.length > 0)) {
		var ex = new Error();
		ex.suberrors = [];
		if (resolutionCache.undeclareds) resolutionCache.undeclareds.forEachOwn(function (key, entries) {
			for (var j = 0; j < entries.length; j++) {
				var subex = new Error();
				subex.message = "Undeclared variable " + key;
				if (entries[j].firstUse) {
					subex.within = entries[j].firstUse.within
					subex.begins = entries[j].firstUse.begins
					subex.ends = entries[j].firstUse.ends
				}
				ex.suberrors.push(subex);
			}
		});
		constantOverrides.forEach(function (c) {
			var subex = new Error();
			subex.message = "Attempt to rewrite constant " + c[0];
			if (c[1]) {
				subex.within = c[1].within;
				subex.begins = c[1].begins;
				subex.ends = c[1].ends;
			}
			ex.suberrors.push(subex)
		});
		throw ex;
	}
	return s.body;
};