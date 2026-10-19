import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { load } = require('js-yaml') as { load: (source: string) => { jobs: Record<string, { steps: { run?: string }[] }> } };

// Operator invariant: Actions dispatches only unit tests, never local e2e journeys.
// Negative control: restore npm test in the actual workflow; this returns ['test'] and fails.
it('dispatches only the unit test script from the Actions producer', () => {
    const workflow = load(readFileSync(resolve(__dirname, '../.github/workflows/yarn-pr-tests.yml'), 'utf8'));
    const scripts = Object.values(workflow.jobs).flatMap(job => job.steps.flatMap(step => {
        if (!step.run) return [];
        return [...step.run.matchAll(/\bnpm\s+(?:run\s+)?(test(?::[\w-]+)?)(?=\s|$)/g)].map(match => match[1]);
    }));
    expect(scripts).toEqual(['test:unit']);
});
