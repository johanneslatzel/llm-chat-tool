import { describe, expect, it } from 'vitest';
import {
    ResultStatus,
    Tool,
    ToolPackage,
    ToolParameters,
    type PartialToolResult,
} from '../../../src/index.js';

class SampleTool extends Tool {
    constructor(name = 'sample') {
        super(name, 'A sample tool', new ToolParameters({}));
    }

    protected async onExecute(_args: Record<string, unknown>): Promise<PartialToolResult> {
        return { result: 'ok', status: ResultStatus.Success };
    }
}

class EmptyPackage extends ToolPackage {}

class StoredPackage extends ToolPackage {
    constructor(tools: Tool[]) {
        super(tools);
    }
}

class DynamicPackage extends ToolPackage {
    constructor(tools: Tool[] = []) {
        super(tools);
        this.add(new SampleTool());
    }
}

class TutorialPackage extends ToolPackage {
    tutorial(): string {
        return 'Use the sample tool.';
    }
}

describe('ToolPackage', () => {
    it('starts empty when no tools are provided', () => {
        expect(new EmptyPackage().tools()).toEqual([]);
    });

    it('stores the tools passed to the constructor', () => {
        const tool = new SampleTool();
        expect(new StoredPackage([tool]).tools()).toEqual([tool]);
    });

    it('adds tools through the protected add method', () => {
        const pkg = new DynamicPackage();
        expect(pkg.tools()).toHaveLength(1);
        expect(pkg.tools()[0]!.name).toBe('sample');
    });

    it('returns null from tutorial by default', () => {
        expect(new EmptyPackage().tutorial()).toBeNull();
    });

    it('allows subclasses to provide a tutorial', () => {
        expect(new TutorialPackage().tutorial()).toBe('Use the sample tool.');
    });
});
