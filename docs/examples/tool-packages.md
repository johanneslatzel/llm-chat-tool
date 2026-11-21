# Tool Packages

A `ToolPackage` groups related tools and can contribute tutorial text. This
example builds a support package with two tools, prints its tools, and executes
one of them.

```typescript
import {
    ResultStatus,
    Tool,
    ToolPackage,
    ToolParameterProperty,
    ToolParameters,
    type PartialToolResult,
} from '@johannes.latzel/llm-chat-tool';

class GreetTool extends Tool {
    constructor() {
        super(
            'greet',
            'Greet a customer by name.',
            new ToolParameters(
                { name: ToolParameterProperty.string('Customer name') },
                ['name'],
            ),
        );
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        return {
            result: `Hello, ${String(args.name)}!`,
            status: ResultStatus.Success,
        };
    }
}

class LookupOrderTool extends Tool {
    constructor() {
        super(
            'lookup_order',
            'Look up an order by ID.',
            new ToolParameters(
                { id: ToolParameterProperty.string('Order ID') },
                ['id'],
            ),
        );
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        return args.id === '42'
            ? { result: 'Order 42: shipped', status: ResultStatus.Success }
            : { result: `Order ${String(args.id)} not found`, status: ResultStatus.Error };
    }
}

class SupportPackage extends ToolPackage {
    constructor() {
        super([new GreetTool(), new LookupOrderTool()]);
    }

    tutorial(): string {
        return 'Use greet to welcome a customer and lookup_order to check an order.';
    }
}

const support = new SupportPackage();

console.log(support.tutorial());

for (const tool of support.tools()) {
    console.log(`${tool.name}: ${tool.description}`);
}

const orderTool = support.tools().find((tool) => tool.name === 'lookup_order');
if (!orderTool) {
    throw new Error('lookup_order is missing from the package.');
}

const [result] = await orderTool.execute({ id: '42' });
console.log(result?.result); // 'Order 42: shipped'
```

## Tutorial text

`tutorial()` returns a plain string:

```text
Use greet to welcome a customer and lookup_order to check an order.
```

The host decides where to surface it. This package does not build a prompt or
attach tutorials to a container.

## See also

- [Tool packages](../tools/packages.md)
- [Executing a tool](executing-tools.md)
- [Defining a tool](../tools/defining-tools.md)
