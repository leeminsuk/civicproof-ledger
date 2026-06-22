import { describe, expect, it } from 'vitest';
import { runDemoScenario } from '../src/demo.js';

describe('demo scenario', () => {
  it('runs two accepted claims and one duplicate rejection', () => {
    const result = runDemoScenario();
    expect(result.stats).toEqual({ totalClaims: 2, duplicateAttempts: 1, programs: 2 });
    expect(result.events.map((event) => event.event)).toEqual(['ClaimRegistered', 'DuplicateDetected', 'ClaimRegistered']);
    expect(result.publicAuditSummary).toContain('PII stored on-chain: 0 fields');
  });
});
