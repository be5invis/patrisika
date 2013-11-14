Patrisika
===================================

An library converts orthogonal AST into SpiderMonkey AST.

Semantic Definitions
-----------------------------------
AST for Patrisika is provided as JavaScript arraies. The following forms represents a node:

### 'identifier'
Represents a variable.
### ['.t', 'name']
Represents a temporary variable.
### ['.lit', value]
Represents a literal value.
### ['.this']
Represents the `this` reference.
### ['.fn', patternParameters, nodeBody]
Represents a function literal. Note that *patternParameters* matches the whole argument list.
### ['.list', ...items]
Represents an array literal.
### ['.obj', ...['propName', propValue, ε | 'get' | 'set']]
Represents an object literal.
### ['.', base, member]
Represents a membering operation, i.e. `base[member]`.
### ['.if', condition, consequent, alternate?]
Represents a conditional evaluation.
### ['.while', condition, body]
Represents a while loop evaluation. It always returns `undefined`.
### ['.seq', ...items]
Represents a sequencial evaluation. Returns the last item evaluated.
### ['.return', value]
Return a value. Similar to JavaScript `return` statement.
### ['.label', 'sLabel', body]
Declare a labelled expression. Labels are used by `.break` nodes.
### ['.break', 'sLabel']
Jumps to the position after the labelled expression `'sLabel'`.
### [fn, ...args]
Once `fn` is a valid node, it means a common function invocation.

Current Passes
-----------------------------------

###Early Semantic Expansion
- **expand-fn-literal** : Expand irregular and optional parameters of function literals
- **expand-try-catch** : Regularize the 2nd argument of `[.try]` nodes
- **expand-assignments** : Expand irregular assignments
- **expand-this** : Expand `[.this]` nodes into `[.t]` nodes

###Variable Scoping
- **resolve-variable-scoping** : Create `[.local]` nodes to handle variable declarations, constant declarations, and variable renaming.
- **convert-eqc** : Convert all `[=c]` nodes into `[=]` nodes. `[=c]` nondes have the same semantics as `[=]`s but are used for constant declarations only.

###Later Semantic Expansion
- **check-break** : Check and rename `[.label]` nodes and `[.break]` nodes.
- **expand-object-literal** : Expand complex object literal (`[.obj]`) nodes into JavaScript-style nodes, which means that there is no 'get' or 'set' kind property pair.
- **cps** : Convert sequences into nested callbacks.

###Optimization
- **expand-iife** : Expand immediately-invoked function expressions into straight statements.

###Regularization

- **regular-nest** : Convert freely-combined nodes into statement-expression hierarchy
- **resolve-t-scoping** : "Declare" all T-variables used
- **denest-seq** : Flatten nesting `[.seq]` nodes

###Transformation
- **codegen** : Convert Patrisika AST into Mozilla AST

License
-----------------------------------
###Patrisika
Patrisika is a library about orthogonal AST for JavaScript

Copyright (c) 2013, Belleve Invis and contributors
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