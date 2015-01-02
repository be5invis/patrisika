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

License
-----------------------------------
###Patrisika
Patrisika is a library about orthogonal AST for JavaScript

Copyright (c) 2013-2014, Belleve Invis and contributors
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the names of the Mozilla Foundation nor the names of project
  contributors may be used to endorse or promote products derived from this
  software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
### Escodegen

Copyright (C) 2012 [Yusuke Suzuki](http://github.com/Constellation)
 (twitter: [@Constellation](http://twitter.com/Constellation)) and other contributors.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.

  * Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in the
    documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

### source-map

SourceNodeMocks has a limited interface of mozilla/source-map SourceNode implementations.

Copyright (c) 2009-2011, Mozilla Foundation and contributors
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the names of the Mozilla Foundation nor the names of project
  contributors may be used to endorse or promote products derived from this
  software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.