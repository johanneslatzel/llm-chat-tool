# Defining a tool

```typescript
import {
    ResultStatus,
    Tool,
    ToolParameters,
    ToolParameterProperty,
    type PartialToolResult,
} from '@johannes.latzel/llm-chat-tool';

class GreetTool extends Tool {
    constructor() {
        super(
            'greet',
            'Greets a person by name.',
            new ToolParameters(
                { name: ToolParameterProperty.string('The name of the person to greet') },
                ['name'],
            ),
        );
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        const name = args.name;
        if (typeof name !== 'string') {
            return { result: 'name must be a string', status: ResultStatus.Error };
        }
        return { result: `Hello, ${name}!`, status: ResultStatus.Success };
    }
}
```

## Safety net

`Tool.execute()` wraps `onExecute()` in a try-catch. If a tool throws, the error
is caught and returned as the result with `status: 'error'`. The original
thrown value is preserved on `ToolResult.error` for inspection after
`execute()`, but error hooks receive an `Error` supplied by the host, not the
`ToolResult`. A tool can therefore throw without escaping `execute()`.

## Parameter validation

Use `this.validateRequiredParams(args, [...])` in `onExecute` to check required
parameters. It throws if a param is missing, and the error boundary handles the
rest:

```typescript
protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
    this.validateRequiredParams(args, ['name']);
    return { result: `Hello, ${String(args.name)}!`, status: ResultStatus.Success };
}
```

`validateRequiredParams()` checks only the top-level names you pass it: it looks
up `args[key]` and throws when the value is `undefined` or `null`. A nested
`.setRequired(...)` declaration is serialized into the JSON Schema and is not
enforced by `execute()`, so `onExecute` has to validate nested values itself.

## Typed parameters

By default all parameters are `string`. To describe the correct type, pass a
`PropertyType` as the second argument:

```typescript
import { PropertyType } from '@johannes.latzel/llm-chat-tool';

new ToolParameterProperty('Item count', PropertyType.Integer)
new ToolParameterProperty('Tags', PropertyType.Array)
new ToolParameterProperty('Is enabled', PropertyType.Boolean)
```

## Static factory methods

The raw `new ToolParameterProperty(...)` constructor works with any type, but
for common cases the static factories are shorter, self-documenting, and
require no `PropertyType` import:

```typescript
ToolParameterProperty.string('A name')
ToolParameterProperty.number('A numeric value')
ToolParameterProperty.integer('An integer count')
ToolParameterProperty.boolean('A true/false flag')
ToolParameterProperty.array('A list of strings')                             // items default to string
ToolParameterProperty.array('A list of scores', ToolParameterProperty.number('A score'))  // custom item type
ToolParameterProperty.array('A list of addresses', ToolParameterProperty.object('')
    .addProperty('street', ToolParameterProperty.string('Street'))
    .build()
)                                                                           // array of objects
ToolParameterProperty.object('A nested object')                              // returns a builder (see below)
```

## Hidden parameter aliases

Models sometimes call an array parameter by a singular name, for example
`path` instead of `paths`. A parameter can accept such hidden aliases without
advertising them in the schema:

```typescript
new ToolParameters(
    {
        paths: ToolParameterProperty.array('Array of file paths to read')
            .accepts('path'),
    },
    ['paths'],
);
```

Rules:

- Aliases are only applied to top-level parameters. Nested object properties
  are not scanned.
- The canonical name always wins. If both `paths` and `path` are present,
  `paths` is used.
- With multiple aliases, the first one declared wins:
  `.accepts('path', 'file')` prefers `path` over `file`.
- For an array-typed parameter, a scalar alias value is wrapped in a
  one-element array (`path: 'a.txt'` becomes `paths: ['a.txt']`).
- Aliases are removed from the arguments before `onExecute` runs.
- Aliases are never serialized into the schema, so `definition()` shows only the canonical parameter.
- Invalid declarations throw at construction: empty aliases, aliases equal to
  the canonical name, aliases that collide with a declared parameter, and
  duplicate aliases across parameters.

Alias normalization applies to every `execute()` call.

## Nested object parameters

For parameters that are objects with their own sub-properties, use
`ToolParameterProperty.object(desc)` which returns an `ObjectPropertyBuilder`:

```typescript
new ToolParameters({
    name: ToolParameterProperty.string('Full name'),
    address: ToolParameterProperty.object('Mailing address')
        .addProperty('street', ToolParameterProperty.string('Street name'))
        .addProperty('city', ToolParameterProperty.string('City'))
        .addProperty('zip', ToolParameterProperty.integer('ZIP code'))
        .setRequired('street', 'city', 'zip')
        .build(),
}, ['name', 'address']);
```

Objects can nest arbitrarily deep:

```typescript
ToolParameterProperty.object('Config')
    .addProperty(
        'database',
        ToolParameterProperty.object('Database settings')
            .addProperty('host', ToolParameterProperty.string('Hostname'))
            .addProperty('port', ToolParameterProperty.integer('Port'))
            .build(),
    )
    .build();
```

The builder only exposes methods valid for objects (`addProperty`,
`setRequired`, `build`).

## Multiple results

A tool can return several independent results in a single call by chaining them
with `ResultBuilder`. Each node becomes a separate tool result for the caller,
each with its own status. Results are linked via a `next` pointer on
`PartialToolResult`; the return type stays `PartialToolResult` regardless of how
many results the builder chains.

```typescript
import { ResultBuilder } from '@johannes.latzel/llm-chat-tool';
import { readFile } from 'node:fs/promises';

protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
    const builder = new ResultBuilder();
    for (const path of args.paths as string[]) {
        try {
            const content = await readFile(path, 'utf-8');
            builder.add({ result: content, status: ResultStatus.Success });
        } catch (err) {
            builder.add({
                result: `Error reading ${path}: ${(err as Error).message}`,
                status: ResultStatus.Error,
            });
        }
    }
    return builder.build();
}
```

Both `ResultBuilder.from(results)` and
`ResultBuilder.resolveAll(promises: Promise<PartialToolResult>[])` turn many
results into one chain: `from()` returns a pre-populated builder, while
`resolveAll()` awaits the promises and returns the finished `PartialToolResult`
head, so it needs no `build()` call. See
[Typed Tools](../examples/typed-tools.md) for a full `from()` example.

`execute()` cannot return an empty array for a well-typed tool: it walks the
chain from the returned head and emits one `ToolResult` per node, so the count
follows the chain. `ResultBuilder.build()` throws `ResultBuilder: no results
added` when nothing was added, so guard an empty collection before calling it.
"No result" is therefore an ordinary result with an explanatory string, for
example `{ result: 'No documents matched.', status: ResultStatus.Success }`,
not an empty array.

The `onExecute` signature stays `Promise<PartialToolResult>`; only multi-result
tools opt in by using `ResultBuilder`.

## Example pages

- [Executing a tool](../examples/executing-tools.md)
- [Typed Tools](../examples/typed-tools.md)
- [Timed Tools](../examples/timed-tools.md)
