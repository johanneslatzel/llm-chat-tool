import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    ResultStatus,
    TimedTool,
    TimedToolNotificationKind,
    Tool,
    ToolParameters,
    type PartialToolResult,
} from '../../../src/index.js';

class SlowTool extends Tool {
    private readonly _gate: Promise<void>;

    constructor(name: string, gate: Promise<void>) {
        super(name, 'slow tool', new ToolParameters({}, []));
        this._gate = gate;
    }

    protected async onExecute(_args: Record<string, unknown>): Promise<PartialToolResult> {
        await this._gate;
        return { result: 'slow done', status: ResultStatus.Success };
    }
}

class FailingTool extends Tool {
    constructor() {
        super('failing', 'failing tool', new ToolParameters({}, []));
    }

    protected async onExecute(_args: Record<string, unknown>): Promise<PartialToolResult> {
        throw new Error('inner boom');
    }
}

class FastTool extends Tool {
    constructor() {
        super('fast', 'fast tool', new ToolParameters({}, []));
    }

    protected async onExecute(args: Record<string, unknown>): Promise<PartialToolResult> {
        return { result: 'fast ' + String(args.value), status: ResultStatus.Success };
    }
}

afterEach(() => {
    vi.useRealTimers();
});

describe('TimedTool', () => {
    it('delegates the provider definition to the wrapped tool', () => {
        const inner = new FastTool();
        const tool = new TimedTool(inner, 50, () => undefined);
        expect(tool.name).toBe('fast');
        expect(tool.description).toBe('fast tool');
        expect(tool.definition()).toEqual(inner.definition());
    });

    it('returns the inner result when the tool finishes in time', async () => {
        const tool = new TimedTool(new FastTool(), 50, () => undefined);
        const results = await tool.execute({ value: 'x' });
        expect(results).toEqual([{ tool: 'fast', result: 'fast x', status: ResultStatus.Success }]);
    });

    it('returns an error result when the tool times out', async () => {
        vi.useFakeTimers();
        const notify = vi.fn();
        const tool = new TimedTool(
            new SlowTool('slow', new Promise<void>(() => undefined)),
            10,
            () => undefined,
            notify,
        );
        const pending = tool.execute({});
        await vi.advanceTimersByTimeAsync(11);
        const results = await pending;
        expect(results[0]?.status).toBe(ResultStatus.Error);
        expect(results[0]?.result).toContain("Tool 'slow' timed out after 10 ms");
        expect(notify).toHaveBeenCalledWith(
            TimedToolNotificationKind.Timeout,
            "Tool 'slow' timed out after 10 ms",
        );
    });

    it('returns an error result when the run is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        const notify = vi.fn();
        const tool = new TimedTool(
            new SlowTool('slow', new Promise<void>(() => undefined)),
            50,
            () => controller.signal,
            notify,
        );
        const results = await tool.execute({});
        expect(results[0]?.result).toContain("Tool 'slow' was cancelled");
        expect(notify).toHaveBeenCalledWith(
            TimedToolNotificationKind.Cancelled,
            "Tool 'slow' was cancelled",
        );
    });

    it('removes the abort listener after a successful call', async () => {
        const controller = new AbortController();
        const tool = new TimedTool(new FastTool(), 50, () => controller.signal);
        const results = await tool.execute({ value: 'z' });
        expect(results[0]?.result).toBe('fast z');
        controller.abort();
    });

    it('returns an error result when the run is aborted mid-call', async () => {
        const controller = new AbortController();
        const tool = new TimedTool(
            new SlowTool('slow', new Promise<void>(() => undefined)),
            50,
            () => controller.signal,
        );
        const pending = tool.execute({});
        controller.abort();
        const results = await pending;
        expect(results[0]?.status).toBe(ResultStatus.Error);
    });

    it('skips the timer when the timeout is disabled', async () => {
        const tool = new TimedTool(new FastTool(), 0, () => undefined);
        const results = await tool.execute({ value: 'y' });
        expect(results[0]?.result).toBe('fast y');
    });

    it('converts an inner rejection into an error result', async () => {
        const tool = new TimedTool(new FailingTool(), 50, () => undefined);
        const results = await tool.execute({});
        expect(results[0]?.status).toBe(ResultStatus.Error);
        expect(results[0]?.result).toContain('inner boom');
    });

    it('keeps multiple inner results in order', async () => {
        const inner = {
            name: 'multi',
            description: 'multi tool',
            definition: () => new FastTool().definition(),
            execute: async () => [
                { tool: 'multi', result: 'one', status: ResultStatus.Success },
                { tool: 'multi', result: 'two', status: ResultStatus.Error },
            ],
        } as unknown as Tool;
        const tool = new TimedTool(inner, 50, () => undefined);
        const results = await tool.execute({});
        expect(results.map((entry) => entry.result)).toEqual(['one', 'two']);
        expect(results[1]?.status).toBe(ResultStatus.Error);
    });

    it('returns a success placeholder when the inner tool yields no results', async () => {
        const inner = {
            name: 'empty',
            description: 'empty tool',
            definition: () => new FastTool().definition(),
            execute: async () => [],
        } as unknown as Tool;
        const tool = new TimedTool(inner, 50, () => undefined);
        const results = await tool.execute({});
        expect(results).toEqual([{ tool: 'empty', result: '', status: ResultStatus.Success }]);
    });

    it('converts an Error rejection into an error result', async () => {
        const inner = {
            name: 'broken',
            description: 'broken tool',
            definition: () => new FastTool().definition(),
            execute: async () => {
                throw new Error('rejected boom');
            },
        } as unknown as Tool;
        const tool = new TimedTool(inner, 50, () => undefined);
        const results = await tool.execute({});
        expect(results[0]?.status).toBe(ResultStatus.Error);
        expect(results[0]?.result).toContain('rejected boom');
    });

    it('converts a non-Error rejection into an error result', async () => {
        const inner = {
            name: 'broken',
            description: 'broken tool',
            definition: () => new FastTool().definition(),
            execute: async () => {
                throw 'plain failure';
            },
        } as unknown as Tool;
        const tool = new TimedTool(inner, 50, () => undefined);
        const results = await tool.execute({});
        expect(results[0]?.status).toBe(ResultStatus.Error);
        expect(results[0]?.result).toContain('plain failure');
    });

    it('ignores a late inner result after a timeout', async () => {
        vi.useFakeTimers();
        let release = (): void => undefined;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const tool = new TimedTool(new SlowTool('slow', gate), 10, () => undefined);
        const pending = tool.execute({});
        await vi.advanceTimersByTimeAsync(11);
        release();
        await vi.advanceTimersByTimeAsync(0);
        const results = await pending;
        expect(results[0]?.result).toContain('timed out');
    });
});
