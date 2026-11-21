# Tool packages

Group related tools into a `ToolPackage` so a host can collect them in one
step:

```typescript
import { ToolPackage, Tool } from '@johannes.latzel/llm-chat-tool';

class GreetTool extends Tool { /* ... */ }
class WeatherTool extends Tool { /* ... */ }

class WeatherPackage extends ToolPackage {
    constructor() {
        super([new GreetTool(), new WeatherTool()]);
    }
}
```

`tools()` returns the bundled instances:

```typescript
const weatherPackage = new WeatherPackage();

for (const tool of weatherPackage.tools()) {
    console.log(tool.name);
}
```

## Tutorial

Override `tutorial()` to return usage text, or leave it as `null` (default):

```typescript
class WeatherPackage extends ToolPackage {
    constructor() {
        super([new GreetTool(), new WeatherTool()]);
    }

    tutorial(): string | null {
        return 'Use greet to say hello and weather to check conditions.';
    }
}
```

The returned string is plain text. The host decides whether and where to
surface it, for example in instructions shown to a model. This package does
not build a prompt or attach tutorials to a container.

The text often names the tools in the package:

```text
Use greet to say hello and weather to check conditions.
```

If `tutorial()` returns `null`, the package contributes no tutorial text.

## Adding tools after construction

Use the protected `add(tool)` method:

```typescript
class WeatherPackage extends ToolPackage {
    constructor() {
        super();
        this.add(new GreetTool());
        this.add(new WeatherTool());
    }
}
```

Tool names should be unique within a host. Name collisions across separate
packages are a host policy, not something this package detects.

## Example pages

- [Tool Packages](../examples/tool-packages.md)
