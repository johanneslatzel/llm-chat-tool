import { describe, expect, it, vi } from 'vitest';
import {
    ResultStatus,
    ToolEvent,
    ToolHookBuilder,
    type ToolEventMap,
    type ToolEventTarget,
    type ToolResult,
} from '../../../src/index.js';

class FakeTarget implements ToolEventTarget {
    private readonly handlers = new Map<ToolEvent, Set<(...args: unknown[]) => void>>();

    on<E extends ToolEvent>(event: E, handler: (...args: ToolEventMap[E]) => void): void {
        const set = this.handlers.get(event) ?? new Set();
        set.add(handler as (...args: unknown[]) => void);
        this.handlers.set(event, set);
    }

    off<E extends ToolEvent>(event: E, handler: (...args: ToolEventMap[E]) => void): void {
        this.handlers.get(event)?.delete(handler as (...args: unknown[]) => void);
    }

    async emit(event: ToolEvent, ...args: unknown[]): Promise<void> {
        for (const handler of [...(this.handlers.get(event) ?? [])]) {
            await handler(...args);
        }
    }

    hook(): ToolHookBuilder {
        return new ToolHookBuilder(this);
    }
}

const RESULT: ToolResult = {
    tool: 'alpha',
    result: 'ok',
    status: ResultStatus.Success,
};

describe('ToolHookBuilder', () => {
    it('fires a before hook for every tool', async () => {
        const target = new FakeTarget();
        const handler = vi.fn();
        const hook = target.hook().before().do(handler);

        await target.emit(ToolEvent.Before, 'alpha', { x: 1 });

        expect(hook).toBeDefined();
        expect(handler).toHaveBeenCalledWith('alpha', { x: 1 });
    });

    it('filters before hooks by one or more tool names', async () => {
        const target = new FakeTarget();
        const single = vi.fn();
        const multiple = vi.fn();
        target.hook().filter('alpha').before().do(single);
        target.hook().filter('alpha', 'beta').before().do(multiple);

        await target.emit(ToolEvent.Before, 'gamma', {});
        expect(single).not.toHaveBeenCalled();
        expect(multiple).not.toHaveBeenCalled();

        await target.emit(ToolEvent.Before, 'beta', {});
        expect(single).not.toHaveBeenCalled();
        expect(multiple).toHaveBeenCalledTimes(1);
    });

    it('treats an empty filter as matching every tool', async () => {
        const target = new FakeTarget();
        const handler = vi.fn();
        target.hook().filter().before().do(handler);

        await target.emit(ToolEvent.Before, 'alpha', {});
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('fires after hooks for matching results', async () => {
        const target = new FakeTarget();
        const handler = vi.fn();
        target.hook().after().do(handler);

        await target.emit(ToolEvent.After, RESULT);

        expect(handler).toHaveBeenCalledWith(RESULT);
    });

    it('skips after hooks for non-matching tool names', async () => {
        const target = new FakeTarget();
        const handler = vi.fn();
        target.hook().filter('beta').after().do(handler);

        await target.emit(ToolEvent.After, RESULT);
        expect(handler).not.toHaveBeenCalled();
    });

    it('fires error hooks for matching tool names', async () => {
        const target = new FakeTarget();
        const handler = vi.fn();
        target.hook().error().do(handler);
        const error = new Error('boom');

        await target.emit(ToolEvent.Error, 'alpha', error);

        expect(handler).toHaveBeenCalledWith('alpha', error);
    });

    it('skips error hooks for non-matching tool names', async () => {
        const target = new FakeTarget();
        const handler = vi.fn();
        target.hook().filter('beta').error().do(handler);

        await target.emit(ToolEvent.Error, 'alpha', new Error('boom'));
        expect(handler).not.toHaveBeenCalled();
    });

    it('stops firing after dispose', async () => {
        const target = new FakeTarget();
        const before = vi.fn();
        const after = vi.fn();
        const error = vi.fn();
        const beforeHook = target.hook().before().do(before);
        const afterHook = target.hook().after().do(after);
        const errorHook = target.hook().error().do(error);

        beforeHook.dispose();
        afterHook.dispose();
        errorHook.dispose();

        await target.emit(ToolEvent.Before, 'alpha', {});
        await target.emit(ToolEvent.After, RESULT);
        await target.emit(ToolEvent.Error, 'alpha', new Error('boom'));

        expect(before).not.toHaveBeenCalled();
        expect(after).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
    });

    it('guards each hook event after disposal', () => {
        const target = new FakeTarget();
        const before = vi.fn();
        const after = vi.fn();
        const error = vi.fn();
        const beforeHook = target.hook().before().do(before) as unknown as {
            _onEvent: (...args: unknown[]) => Promise<void>;
            dispose(): void;
        };
        const afterHook = target.hook().after().do(after) as unknown as {
            _onEvent: (...args: unknown[]) => Promise<void>;
            dispose(): void;
        };
        const errorHook = target.hook().error().do(error) as unknown as {
            _onEvent: (...args: unknown[]) => Promise<void>;
            dispose(): void;
        };

        beforeHook.dispose();
        afterHook.dispose();
        errorHook.dispose();

        return Promise.all([
            beforeHook._onEvent('alpha', {}),
            afterHook._onEvent(RESULT),
            errorHook._onEvent('alpha', new Error('boom')),
        ]).then(() => {
            expect(before).not.toHaveBeenCalled();
            expect(after).not.toHaveBeenCalled();
            expect(error).not.toHaveBeenCalled();
        });
    });

    it('awaits async handlers', async () => {
        const target = new FakeTarget();
        let completed = false;
        target
            .hook()
            .before()
            .do(async () => {
                await Promise.resolve();
                completed = true;
            });

        await target.emit(ToolEvent.Before, 'alpha', {});
        expect(completed).toBe(true);
    });

    it('catches synchronous handler errors', async () => {
        const target = new FakeTarget();
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        target
            .hook()
            .before()
            .do(() => {
                throw new Error('sync failure');
            });

        await expect(target.emit(ToolEvent.Before, 'alpha', {})).resolves.toBeUndefined();
        expect(consoleSpy).toHaveBeenCalledWith('Hook callback error:', expect.any(Error));
        consoleSpy.mockRestore();
    });

    it('catches async handler rejections', async () => {
        const target = new FakeTarget();
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        target
            .hook()
            .after()
            .do(async () => {
                throw new Error('async failure');
            });

        await expect(target.emit(ToolEvent.After, RESULT)).resolves.toBeUndefined();
        expect(consoleSpy).toHaveBeenCalledWith('Hook callback error:', expect.any(Error));
        consoleSpy.mockRestore();
    });

    it('returns a builder whose do() returns a disposable hook', async () => {
        const target = new FakeTarget();
        const builder = target.hook().filter('alpha');
        const hook = builder.before().do(() => undefined);

        expect(typeof hook.dispose).toBe('function');
        hook.dispose();
        hook.dispose();
    });
});
