# Tools

This package supplies tool primitives, not a registry or an execution loop. A
host stores `Tool` instances, looks them up by `name`, and calls `execute()`
when it wants a tool to run.

## Guides

- [Defining a tool](defining-tools.md) - parameters, descriptions, nested schemas and multiple results
- [Registration](registration.md) - build a host-owned tool index
- [Tool packages](packages.md) - group tools and contribute tutorial text
- [Timed tools](timed-tools.md) - bound a call with a timeout and abort signal
- [Tool hooks](tool-hooks.md) - observe before, after and error events

## Examples

- [Executing a tool](../examples/executing-tools.md)
- [Typed tools](../examples/typed-tools.md)
- [Tool packages](../examples/tool-packages.md)
- [Timed tools](../examples/timed-tools.md)
