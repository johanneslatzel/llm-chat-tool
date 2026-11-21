# Registration

This package does not ship a registry or a runtime. Registration is a host
concern: collect `Tool` instances and keep them in a map keyed by `tool.name`.

## Collect tools from a package

`ToolPackage.tools()` returns the bundled instances:

```typescript
import { ToolPackage } from '@johannes.latzel/llm-chat-tool';
import { GreetTool } from './greet-tool.js';

class GreetPackage extends ToolPackage {
    constructor() {
        super([new GreetTool()]);
    }
}
```

## Build an index

```typescript
import type { Tool } from '@johannes.latzel/llm-chat-tool';
import { GreetPackage } from './greet-package.js';

const tools = new Map<string, Tool>();

for (const tool of new GreetPackage().tools()) {
    if (tools.has(tool.name)) {
        throw new Error(`A tool named '${tool.name}' is already registered.`);
    }
    tools.set(tool.name, tool);
}
```

## Dispatch by name

```typescript
const tool = tools.get('greet');
if (!tool) {
    throw new Error('No tool named greet is registered.');
}

const [result] = await tool.execute({ name: 'Ada' });
console.log(result?.result); // 'Hello, Ada!'
```

`tools.get(...)` returns `undefined` when no tool with that name is indexed.

## Dispatch a call

A host receives a tool name and an already-parsed argument object. Map them onto
the index above:

```typescript
import type { ToolResult } from '@johannes.latzel/llm-chat-tool';

async function dispatchCall(
    name: string,
    args: Record<string, unknown>,
): Promise<ToolResult[]> {
    const tool = tools.get(name);
    if (!tool) {
        throw new Error(`No tool named '${name}' is registered.`);
    }
    return tool.execute(args);
}
```

Parsing a model's wire format and attaching results to conversation messages are
host responsibilities. This package neither parses calls nor writes messages.

## Naming policy

Tool names should be unique within a host. This package does not enforce that
across separate `ToolPackage` instances; the index above throws on duplicates
as one possible policy.

## Example pages

- [Executing a tool](../examples/executing-tools.md)
- [Tool Packages](../examples/tool-packages.md)
