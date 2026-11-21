# API Reference

## Tool

Abstract base class for a callable tool.

```typescript
abstract class Tool {
    readonly name: string;
    readonly description: string;
    constructor(name: string, description: string, parameters: ToolParameters);
    definition(): ToolDefinition;
    execute(args: Record<string, unknown>): Promise<ToolResult[]>;
    normalizeArguments(args: Record<string, unknown>): Record<string, unknown>;
    protected validateRequiredParams(args: Record<string, unknown>, required: string[]): void;
}
```

Subclasses implement `protected onExecute(args): Promise<PartialToolResult>`.
The base class normalizes aliases, walks the result chain, and converts thrown
values into error results.

## ToolDefinition

Neutral description of a callable tool with `name`, `description` and JSON
Schema `parameters`. A host maps it to its own wire format.

```typescript
type ToolDefinition = {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
};
```

## ToolParameters

Builds the JSON Schema input for a tool.

```typescript
class ToolParameters {
    type: string;
    properties: Record<string, ToolParameterProperty>;
    required?: string[];
    constructor(properties: Record<string, ToolParameterProperty>, required?: string[]);
    toJSON(): Record<string, unknown>;
    normalizeArguments(args: Record<string, unknown>): Record<string, unknown>;
}
```

## ToolParameterProperty

Describes one parameter.

```typescript
class ToolParameterProperty {
    constructor(description: string, type?: PropertyType);
    static string(description: string): ToolParameterProperty;
    static number(description: string): ToolParameterProperty;
    static integer(description: string): ToolParameterProperty;
    static boolean(description: string): ToolParameterProperty;
    static array(description: string, items?: ToolParameterProperty): ToolParameterProperty;
    static object(description: string): ObjectPropertyBuilder;
    accepts(...aliases: string[]): ToolParameterProperty;
}
```

`PropertyType` covers the JSON Schema scalar and container types.
`ObjectPropertyBuilder` adds `addProperty()`, `setRequired()` and `build()`
for nested objects.

### Aliases

Aliases are hidden input names. They are removed before `onExecute`, never
serialized into the schema, and must be unique. A scalar value for an array
alias is wrapped in a one-element array.

## ResultStatus, ToolResult and ResultBuilder

`ResultStatus` is `Success` or `Error`.

`PartialToolResult` is
`{ result: string; status: ResultStatus; next?: PartialToolResult }`.
`ToolResult` adds the owning tool name and the optional original `error`, which
is set only when the tool threw.

```typescript
class ResultBuilder {
    add(result: PartialToolResult): this;
    build(): PartialToolResult;
    static from(results: PartialToolResult[]): ResultBuilder;
    static resolveAll(promises: Promise<PartialToolResult>[]): Promise<PartialToolResult>;
}
```

## ToolPackage

Abstract bundle of related tools.

```typescript
abstract class ToolPackage {
    constructor(tools?: Tool[]);
    tools(): Tool[];
    tutorial(): string | null;
    protected add(tool: Tool): void;
}
```

`tutorial()` defaults to `null`. A non-null value is plain text a host can
surface in its instructions. The package does not attach tutorials to a
container.

## Hooks

- `Hook`: idempotent disposal, protected `safeInvoke()` and `asyncSafeInvoke()`
- `HookBuilderBase<TCallback>`: base for hook builders
- `HasHooks<TBuilder>`: object with a `hook()` method
- `ToolHookBuilder`: `filter(...names).before()/after()/error().do(handler)`
- `ToolEvent`: `Before`, `After`, `Error`
- `ToolEventTarget`: `on(event, handler)` and `off(event, handler)`

`ToolHookBuilder` takes a `ToolEventTarget` supplied by the host. The package
does not emit events itself.

## ToolEventMap

The payload tuples that `ToolEventTarget.on()` and `off()` bind to handlers:

```typescript
type ToolEventMap = {
    [ToolEvent.Before]: [name: string, args: Record<string, unknown>];
    [ToolEvent.After]: [result: ToolResult];
    [ToolEvent.Error]: [name: string, error: Error];
};
```

Before-hooks receive the live argument object, after-hooks receive one
`ToolResult`, and error-hooks receive an `Error`. Which results the host
emits, and whether `after` fires once per successful node, is host policy; the
`llm-chat` engine emits it once per successful result. `ToolHookOptions` is
`{ tools?: string[] }` and is filled in by `.filter(...names)`.

## TimedTool

```typescript
class TimedTool extends Tool {
    constructor(
        inner: Tool,
        timeoutMs: number,
        signal: () => AbortSignal | undefined,
        notify?: (kind: TimedToolNotificationKind, message: string) => void,
    );
}
```

`TimedToolNotificationKind` is `Timeout` or `Cancelled`. A non-positive
`timeoutMs` disables the timeout wrapper, and `signal` is then never called.
Otherwise `signal` is called once per execution and may return `undefined`.


