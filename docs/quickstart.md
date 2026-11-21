# Quick Start

## Installation

```bash
npm install @johannes.latzel/llm-chat-tool
```

This package has no runtime dependencies, so this is the only install needed.

## Prerequisites

| Requirement | Value |
|---|---|
| Node.js | >= 18 |
| Module format | ESM-only; add `"type": "module"` to your `package.json` |
| TypeScript | Optional; `.d.ts` files are included |
| Runner | A TypeScript ESM runner, for example `npx tsx` |

A new project needs no more than this:

```bash
npm init -y
npm pkg set type=module
npm install @johannes.latzel/llm-chat-tool
```

The snippets are ES modules that import with `.js` specifiers, for example
`import { GreetTool } from './greet-tool.js'`; `tsx` resolves them to the `.ts`
files. Save a snippet and run it:

```bash
npx tsx greet.ts
```

## Define a tool

```typescript
import {
    ResultStatus,
    Tool,
    ToolParameters,
    ToolParameterProperty,
    type PartialToolResult,
} from '@johannes.latzel/llm-chat-tool';

export class GreetTool extends Tool {
    constructor() {
        super(
            'greet',
            'Greets a person by name.',
            new ToolParameters(
                { name: ToolParameterProperty.string('Person to greet.') },
                ['name'],
            ),
        );
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        this.validateRequiredParams(args, ['name']);
        return { result: `Hello, ${String(args.name)}!`, status: ResultStatus.Success };
    }
}
```

Save this as `greet-tool.ts`.

## Execute the tool

Call `execute()` directly. It normalizes aliases and returns one `ToolResult`
per result node:

```typescript
import { GreetTool } from './greet-tool.js';

const greet = new GreetTool();
const [result] = await greet.execute({ name: 'Ada' });

console.log(result?.status); // 'success'
console.log(result?.result); // 'Hello, Ada!'
```

Save this as `greet.ts` next to `greet-tool.ts` and run `npx tsx greet.ts`.

## Inspect the definition

`definition()` returns the neutral description an adapter can translate into
its own model format:

```typescript
type ToolDefinition = {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
};
```

```typescript
const definition = greet.definition();
console.log(definition.parameters);
```

## Bundle tools

```typescript
import { ToolPackage } from '@johannes.latzel/llm-chat-tool';
import { GreetTool } from './greet-tool.js';

export class GreetPackage extends ToolPackage {
    constructor() {
        super([new GreetTool()]);
    }

    tutorial(): string | null {
        return 'Use greet to welcome a user by name.';
    }
}
```

`tools()` returns the bundled instances:

```typescript
const greetPackage = new GreetPackage();

for (const tool of greetPackage.tools()) {
    console.log(tool.name);
}
```

The package itself does not execute or store tool bundles. The host keeps the
instances it needs.

## Next steps

- [Defining a tool](tools/defining-tools.md) - parameters, aliases, nested schemas and multiple results
- [Registration](tools/registration.md) - build a host-owned tool index
- [Tool packages](tools/packages.md) - grouping and tutorial text
- [Timed tools](tools/timed-tools.md) - timeouts and cancellation
- [Tool hooks](tools/tool-hooks.md) - before, after and error events
- [Examples](examples/index.md) - complete runnable programs
- [API Reference](api-reference.md) - the full surface
- [Architecture](architecture.md) - the execution model
