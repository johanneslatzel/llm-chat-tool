# Timed tools

`TimedTool` wraps a tool and bounds how long the caller waits for one
execution. This example wraps a five-second search with a two-second timeout.

```typescript
import {
    ResultStatus,
    TimedTool,
    Tool,
    ToolParameterProperty,
    ToolParameters,
    type PartialToolResult,
} from '@johannes.latzel/llm-chat-tool';

class SlowSearchTool extends Tool {
    constructor() {
        super(
            'slow_search',
            'Search an external index. The request takes five seconds.',
            new ToolParameters(
                { query: ToolParameterProperty.string('Search query') },
                ['query'],
            ),
        );
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        return {
            result: `Results for ${String(args.query)}`,
            status: ResultStatus.Success,
        };
    }
}

const controller = new AbortController();

const tool = new TimedTool(
    new SlowSearchTool(),
    2_000,
    () => controller.signal,
    (kind, message) => console.warn(`[${kind}] ${message}`),
);

const [result] = await tool.execute({ query: 'primitives' });

console.log(result?.status); // 'error'
console.log(result?.result); // Error: Tool 'slow_search' timed out after 2000 ms
```

## What happens

- The wrapper delegates the tool schema to `SlowSearchTool`.
- After two seconds it resolves with the error result
  `Error: Tool 'slow_search' timed out after 2000 ms`.
- The notify callback receives `TimedToolNotificationKind.Timeout`.
- The caller continues with the error result instead of hanging.

The inner tool is not stopped; it may still finish in the background. The
wrapper only bounds the wait.

## Cancellation

Pass a signal getter that returns an `AbortSignal` to cancel a call from the
outside:

```typescript
const cancelController = new AbortController();
const cancellable = new TimedTool(
    new SlowSearchTool(),
    30_000,
    () => cancelController.signal,
);

cancelController.abort();

const [cancelled] = await cancellable.execute({ query: 'primitives' });
console.log(cancelled?.result); // Error: Tool 'slow_search' was cancelled
```

The getter may return `undefined` when the caller has no cancellation source.
See [Timed tools](../tools/timed-tools.md) for the full contract.

## See also

- [Timed tools](../tools/timed-tools.md)
- [Defining a tool](../tools/defining-tools.md)
- [Tool hooks](../tools/tool-hooks.md)
