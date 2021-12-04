# @peterdekok/ts-ast

A (typescript) code change tool, through manipulation of ASTs, using [jscodeshift](https://www.npmjs.com/package/jscodeshift). 

It provides a singular and very opinionated interface to change certain aspects of code files. 

Currently, the amount of transformations is limited, 
however, custom transformations can be injected manually.

I'm very open to PRs, as my free time does not give me a lot of chances to work on big features, however, nothing breaking, unless for a very good reason.

## Installation
Add to a project:

```bash
yarn add @peterdekok/ast
```

## Usage
```ts
import Ast from '@peterdekok/ast';

const file: Ast = new Ast(path.resolve('path/to/file.ext'));

// runTransformation<T extends { [key: string]: any }>(transformer: Transformer<T>, context: T);
file.runTransformation(AddImport, {
    source: 'fs',
    specifiers: [ { local: 'fs', exported: '*' } ],
});
```

A transformation is immediately run and the file written to.

Calling `runTransformation` requires two arguments:
1. The transformer constructor object.
2. The context required by transformer.

## Transformations

1. [Imports](#imports)
   1. [AddImport](#addimport)
   2. [RemoveImport](#removeimport)
2. [Generic](#generic)
   1. [AddCodeBlock](#addcodeblock)
3. [Vue](#vue-specific)
   1. [AddPluginInstaller](#addplugininstaller)
   1. [AddRootOptions](#addrootoptions)

### Imports
#### AddImport
Add an import to the file.

```ts
import { AddImport, ImportContext } from '@peterdekok/ast/transformations/imports';
```

New imports are inserted at the top of the file, 
after existing imports of the same module type (package vs relative).

When an import already exists, a warning is sent to the logger
and the transformer will skip that specifier. 
Other specifiers will still be added.

Context:
```ts
interface ImportContext {
    source: string; // e.g.: 'fs', '@peterdekok/ast' or './relative/module'
    specifiers?: { 
        local: string; // i.e.: it's local name (e.g.: 'Ast')
        exported: string; // i.e.: it's exported name (e.g.: 'default', '*' or 'Name')
    };
    comment?: string; // A comment if it should be added above the import declaration.
}
```

### RemoveImport
Remove import specifiers from the file.

```ts
import { RemoveImport, RemoveImportContext } from '@peterdekok/ast/transformations/imports';
```
See [AddImport](#addimport).

Context:
```ts
interface RemoveImportContext extends ImportContext {
    keepSourceForSideEffects?: true;
}
```

If the import declaration is empty, it will also be removed, unless the `keepSourceForSideEffects`
option is given. This can be useful if the import has side-effects that should be kept.

### Generic
#### AddCodeBlock
Add a generic code block to the end of the file.

```ts
import { AddCodeBlock, CodeBlockContext } from '@peterdekok/ast/transformations/generic';
```

Context:
```ts
interface CodeBlockContext {
    code: string;
    title: string; // E.g. comment before the code block + logging title
    search?: string | object | object[]; // e.g.: 'new Vue().$mount()'. This will find 'new Vue({ options }).$mount('#app');' as well.
    location?: 'before' | 'after';
    ignore?: 'strict' | 'selective' | 'complete' | 'never';
    newline?: 'both' | 'before' | 'after';
}
```

Optionally, a location can be searched to add the expression(s).

By default, this transformation is skipped if (part) of the expression(s) are already present.
However, this behaviour can be defined.

The code given will be parsed into an AST, before adding it.
Therefore, syntax needs to be valid, however,
there is no validation whether it is code that works or even compiles properly.

### Vue specific
#### AddPluginInstaller

Add a Vue plugin installer (i.e. invoke `Vue.use`).

```ts
import { AddPluginInstaller, PluginInstallerContext } from '@peterdekok/ast/transformations/vue';
```

Context:
```ts
interface PluginInstallerContext {
    plugin: string;
    options?: string[];
    comment?: string; // Add a comment above the expression
}
```

It requires the name of an identifier (e.g.: `VueRouter`).

Can be given options to create an expression like:
```ts
Vue.use(PluginInstaller, 'option 1', { option: 2 });
```
Every option will be parsed into an AST, before adding it.
Therefore, syntax needs to be valid. For example, a string should be quoted, 
otherwise it might be seen as an identifier (or not parse at all).
However, there is no validation whether it is code that works or even compiles properly.
```ts
const context: PluginInstallerContext = {
    plugin: PluginInstaller,
    options: [
        '\'option 1\'',
        '{ options: 2 }',
    ]
}
```

#### AddRootOption
Add an option to the `new Vue` invocation.

```ts
import { AddRootOption, RootOptionContext } from '@peterdekok/ast/transformations/vue';
```

A type can also be declared for the module declaration augmentation (`vue/types/options` `ComponentOptions` interface)

Context:
```ts
interface RootOptionContext {
    key: string,
    value: string,
    type?: string,
    comment?: string,
}
```

The value given will be parsed into an AST, before adding it.
Therefore, syntax needs to be valid, however, 
there is no validation whether it is code that works or even compiles properly.
