import { describe, expect, it } from 'vitest';
import { runAttackCorpus } from '../src/attackCorpus.js';

describe('Red-Team Attack Corpus', () => {
  it('blocks 100% of the adversarial scenarios', async () => {
    const report = await runAttackCorpus();

    const leaked = report.results.filter((result) => !result.blocked);
    expect(leaked, `leaked attacks: ${leaked.map((entry) => entry.id).join(', ')}`).toEqual([]);
    expect(report.allBlocked).toBe(true);
    expect(report.blocked).toBe(report.total);
  });

  it('covers all five defense categories with at least 12 scenarios', async () => {
    const report = await runAttackCorpus();

    expect(report.total).toBeGreaterThanOrEqual(12);
    expect(new Set(report.results.map((result) => result.category))).toEqual(
      new Set(['credential', 'ledger', 'proof', 'audit-log', 'privacy'])
    );
  });

  it('produces a deterministic, machine-readable report shape', async () => {
    const report = await runAttackCorpus();

    expect(report.protocol).toBe('civicproof-redteam-v1');
    for (const result of report.results) {
      expect(result.id).toMatch(/^ATK-\d{2}$/);
      expect(result.expectedDefense.length).toBeGreaterThan(0);
      expect(result.observed.length).toBeGreaterThan(0);
    }
    const ids = report.results.map((result) => result.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
