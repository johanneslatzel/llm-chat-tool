import { describe, expect, it } from 'vitest';
import {
    Hook,
    HookBuilderBase,
    ResultBuilder,
    ResultStatus,
    TimedToolNotificationKind,
    Tool,
    ToolEvent,
    ToolHookBuilder,
    ToolPackage,
    ToolParameterProperty,
    ToolParameters,
    type PartialToolResult,
} from '../../src/index.js';

class ThrowingTool extends Tool {
    constructor() {
        super('throwing_tool', 'A throwing tool', new ToolParameters({}));
    }

    protected async onExecute(_args: Record<string, unknown>): Promise<PartialToolResult> {
        throw 'boom';
    }
}

class DefinitionTool extends Tool {
    constructor() {
        super('definition_tool', 'A definition tool', new ToolParameters({}));
    }

    protected async onExecute(_args: Record<string, unknown>): Promise<PartialToolResult> {
        return { result: 'ok', status: ResultStatus.Success };
    }
}

describe('package exports', () => {
    it('exports the runtime tool and hook surface', () => {
        expect(Tool).toBeDefined();
        expect(ToolPackage).toBeDefined();
        expect(ToolParameters).toBeDefined();
        expect(ToolParameterProperty).toBeDefined();
        expect(ResultStatus).toBeDefined();
        expect(ResultBuilder).toBeDefined();
        expect(Hook).toBeDefined();
        expect(HookBuilderBase).toBeDefined();
        expect(ToolEvent).toBeDefined();
        expect(ToolHookBuilder).toBeDefined();
    });

    it('exports the timed-tool notification kinds', () => {
        expect(TimedToolNotificationKind.Timeout).toBe('timeout');
        expect(TimedToolNotificationKind.Cancelled).toBe('cancelled');
    });

    it('converts a non-Error throw into an error result', async () => {
        const results = await new ThrowingTool().execute({});
        expect(results[0]?.status).toBe(ResultStatus.Error);
        expect(results[0]?.result).toBe('Error: boom');
    });

    it('produces the provider-neutral definition without a provider wrapper', () => {
        const tool = new DefinitionTool();
        const definition = tool.definition();
        expect(definition).toEqual({
            name: 'definition_tool',
            description: 'A definition tool',
            parameters: { type: 'object', properties: {} },
        });
        expect('toOpenAI' in tool).toBe(false);
    });
});
