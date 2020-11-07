<img src="https://rawgit.com/be5invis/patrisika/7f2783ca91ccaa7481c8ea8c1ed4f0d881ceaff8/resources/patrisika-logo.svg" height="32" width="32"/> Patrisika [Revented]
===================================

An library converts orthogonal AST into SpiderMonkey AST.

Semantics
-----------------------------------
AST for Patrisika is provided as JavaScript arraies. The following forms represents a node:

### 'identifier'
Represents a variable.
### ['.quote', value]
Represents a literal value.
### ['.unit']
Represents `undefined` value.
### ['.thisp']
Represents `this` reference.
### ['.argsp']
Represents argument list passed into the current function.
### ['.lambda', [...params], body]
Defines an anonymous function.
### ['.list', ...items]
Represents an array.
### ['.hash', ...['propName', propValue]]
Represents an object.
### ['.', base, member]
Represents a membering operation, i.e. `base[member]`.
### ['.if', condition, consequent, alternate?]
Represents a conditional evaluation.
### ['.while', condition, body]
Represents a while loop evaluation. It returns the value of `body` in the last evaluation.
### ['.begin', ...items]
Represents a sequencial evaluation. Returns the last item evaluated.
### ['.return', value]
Return a value. Similar to JavaScript `return` statement.
### ['.try', block, [param], handler]
Represents a exception handling expression. Returns the value of `block` normally, or the value of `handler1` when a exception is thrown during evaluating `block`.
### ['.throw', value]
Throws value as an exception.
### ['.set', left, right]
Assign `right` to variable or property node `left`.
### [fn, ...args]
Once `fn` is a valid node, it means a common function invocation.
### ['.new', callee, ...args]
Initiates an instance of constructor `callee`, with `args` as arguments.
### ['.yield', value]
Represents a ES6 `yield` expression. Any functions directly containing such node will become a generator function described in ES6 specification.
### ['.beta', [...params], body, ...args]
Represents a beta redex which is similar to `[['.lambda', [...params], body], ...args]`, used to implement semantics of `let` in scheme.
### Operators
- Unary operator
  - `['.typeof', x]` : `typeof`
  - `['!', x]` : `!`
  - `['+', x]` : `+`
  - `['-', x]` : `-`
- Binary and Logical operator
  - `['+', x, y]` : `+` (both numeric and string)
  - `['-', x, y]` : `-`
  - `['*', x, y]` : `*`
  - `['/', x, y]` : `/`
  - `['%', x, y]` : `%`
  - `['<', x, y]` : `<`
  - `['>', x, y]` : `>`
  - `['<=', x, y]` : `<=`
  - `['>=', x, y]` : `>=`
  - `['===', x, y]` : `===`
  - `['!==', x, y]` : `!==`
  - `['=~', x, y]` : `==`
  - `['!~', x, y]` : `!=`
  - `['.is', x, y]` : `instanceof`
  - `['&&', x, y]` : `&&`
  - `['||', x, y]` : `||`

Usage
-----------------------------------
Using Patrisika is pretty simple and straight forward:

```javascript
// Note : global scopes must be provided. Undeclared variables in Patrisika
//        are treated as local variables, instead of global.
var globalScope = new Patrisika.DefaultExterns;
globalScope.declare("globalVariable");
patrisika.compile(ast, globals);
```
