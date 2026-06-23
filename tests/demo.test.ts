import { describe, expect, it } from 'vitest';
import { runDemoScenario } from '../src/demo.js';

describe('demo scenario', () => {
  it('runs two accepted claims and one duplicate rejection', async () => {
    const result = await runDemoScenario();
    expect(result.stats).toEqual({ totalClaims: 2, duplicateAttempts: 1, programs: 2 });
    expect(result.events.map((event) => event.event)).toEqual(['ClaimRegistered', 'DuplicateDetected', 'ClaimRegistered']);
    expect(result.publicAuditSummary).toContain('PII stored on-chain: 0 fields');
  });

  it('includes signed demo credentials and verifier outcomes in JSON output', async () => {
    const result = await runDemoScenario();

    expect(result.credentials).toHaveLength(3);
    expect(result.credentials.every((credential) => credential.proof.type === 'Ed25519Signature2020Demo')).toBe(true);
    expect(result.verifierResults.map((entry) => entry.status)).toEqual(['normal', 'duplicate', 'normal']);
  });
});
