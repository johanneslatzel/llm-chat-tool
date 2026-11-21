# Executing a Tool

A tool is an ordinary object. Call `execute()` with an argument object and read
the returned results. No model is involved in this example.

The tool uses [wttr.in](https://wttr.in/), which returns plain text and needs no
API key.

```typescript
import {
    ResultStatus,
    Tool,
    ToolParameterProperty,
    ToolParameters,
    type PartialToolResult,
} from '@johannes.latzel/llm-chat-tool';

class WeatherTool extends Tool {
    constructor() {
        super(
            'get_weather',
            'Get the current weather for a city.',
            new ToolParameters(
                { city: ToolParameterProperty.string('City name') },
                ['city'],
            ),
        );
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        this.validateRequiredParams(args, ['city']);

        const city = args.city;
        if (typeof city !== 'string') {
            return { result: 'city must be a string', status: ResultStatus.Error };
        }

        const response = await fetch(
            `https://wttr.in/${encodeURIComponent(city)}?format=%C+%t`,
        );
        if (!response.ok) {
            return {
                result: `Weather request failed: ${response.status}`,
                status: ResultStatus.Error,
            };
        }

        const weather = (await response.text()).replace(/\s+/g, ' ').trim();
        return { result: `${weather} in ${city}`, status: ResultStatus.Success };
    }
}

const weather = new WeatherTool();
const [result] = await weather.execute({ city: 'Berlin' });

if (!result) {
    throw new Error('The tool returned no result.');
}

console.log(`[${result.status}] ${result.result}`);
```

## What happens

1. `execute()` normalizes aliases and calls `onExecute()`.
2. `onExecute()` validates `city`, performs the HTTP request and returns a
   `PartialToolResult`.
3. `execute()` converts the result into an array with one `ToolResult`.
4. A failed request returns an error result instead of throwing. A thrown value
   is also caught and returned as an error result.

## Inspect the definition

`definition()` describes the tool without running it:

```typescript
console.log(weather.definition());
// {
//     name: 'get_weather',
//     description: 'Get the current weather for a city.',
//     parameters: { type: 'object', properties: { ... }, required: ['city'] }
// }
```

## See also

- [Defining a tool](../tools/defining-tools.md)
- [Tool hooks](../tools/tool-hooks.md)
- [Typed tools](typed-tools.md)
