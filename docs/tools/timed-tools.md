# Timed tools

`TimedTool` wraps any `Tool` and bounds how long the caller waits for one
execution. It is a generic decorator: it only depends on this package's `Tool`
and result types, and it does not add a default timeout.

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
        return { result: `Results for ${String(args.query)}`, status: ResultStatus.Success };
    }
}

const controller = new AbortController();

const tool = new TimedTool(
    new SlowSearchTool(),
    2_000,
    () => controller.signal,
    (kind, message) => console.warn(kind, message),
);

const [result] = await tool.execute({ query: 'primitives' });
console.log(result?.status); // 'error'
console.log(result?.result); // Error: Tool 'slow_search' timed out after 2000 ms
```

## Constructor

```typescript
new TimedTool(
    inner: Tool,
    timeoutMs: number,
    signal: () => AbortSignal | undefined,
    notify?: (kind: TimedToolNotificationKind, message: string) => void,
);
```

`inner`, `timeoutMs` and `signal` are required. `notify` is optional.

- A `timeoutMs` of zero or less disables the timeout wrapper: the inner tool
  runs directly, without the timeout/abort race.
- `signal` is required. It is called once per execution that runs under a
  timeout, and may return `undefined` when the caller has no abort signal. With a
  non-positive `timeoutMs` the getter is never called, so cancellation has no
  effect on a disabled wrapper.
- `notify` is optional and defaults to a no-op. It receives
  `TimedToolNotificationKind.Timeout` or
  `TimedToolNotificationKind.Cancelled`; the wrapper does not log itself. The
  callback is not protected by a try-catch, so keep it non-throwing: an
  exception propagates out of the timer or abort callback instead of being
  ignored, and because `notify` runs before the result is settled, the
  execution promise is left unsettled.

## Behavior

- `definition()` delegates to the wrapped tool.
- A normal execution returns the inner results in order, flattened into the
  `PartialToolResult` chain.
- A timeout returns an error result:
  `Error: Tool '<name>' timed out after <n> ms`.
- An already-aborted or mid-call abort returns an error result:
  `Error: Tool '<name>' was cancelled`.
- An inner rejection, including a non-Error rejection, becomes an error result.
- A late inner result after a timeout is ignored.
- Abort listeners are removed when the call settles.
- The timeout timer is unreferenced, so it does not keep the process alive on
  its own.

## Cancellation limits

The wrapper only bounds the **wait**. It cannot force the inner tool to stop.
A file write or network request may continue after a timeout or abort; the
wrapper resolves with an error and lets the caller continue. Callers that need
hard cancellation must implement it inside the tool.

## See also

- [Timed tools example](../examples/timed-tools.md)
- [Defining tools](defining-tools.md)
- [Tool hooks](tool-hooks.md)
