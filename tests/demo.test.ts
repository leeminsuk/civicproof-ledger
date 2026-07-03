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

  it('replay-verifies the demo ledger and reports a MATCH state root', async () => {
    const result = await runDemoScenario();

    expect(result.replayVerification.match).toBe(true);
    expect(result.replayVerification.divergences).toEqual([]);
    expect(result.replayVerification.replayedStateRoot).toBe(result.replayVerification.liveStateRoot);
    expect(result.publicAuditSummary).toContain('Replay verification: MATCH');
  });

  it('scores the demo ledger 100/100 EXCELLENT on the Civic Integrity Index', async () => {
    const result = await runDemoScenario();

    expect(result.integrityIndex.formula).toBe('cii-v1');
    expect(result.integrityIndex.score).toBe(100);
    expect(result.integrityIndex.grade).toBe('EXCELLENT');
    expect(result.publicAuditSummary).toContain('Civic Integrity Index: 100/100 EXCELLENT');
  });
});
