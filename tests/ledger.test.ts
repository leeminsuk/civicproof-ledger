import { describe, expect, it } from 'vitest';
import { createNullifier, InMemoryClaimRegistry } from '../src/ledger.js';

describe('CivicProof claim registry', () => {
  it('creates deterministic program-scoped nullifiers without exposing personal data', () => {
    const a = createNullifier({ programId: 'osscontest-2026', subjectId: '홍길동-990101', salt: 'team-secret' });
    const b = createNullifier({ programId: 'osscontest-2026', subjectId: '홍길동-990101', salt: 'team-secret' });
    const otherProgram = createNullifier({ programId: 'scholarship-2026', subjectId: '홍길동-990101', salt: 'team-secret' });

    expect(a).toBe(b);
    expect(a).not.toContain('홍길동');
    expect(a).not.toContain('990101');
    expect(a).not.toBe(otherProgram);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('accepts first claim and rejects duplicate claim for same program/nullifier', () => {
    const registry = new InMemoryClaimRegistry();
    const nullifier = createNullifier({ programId: 'grant-a', subjectId: 'applicant-1', salt: 's1' });

    const first = registry.registerClaim({ programId: 'grant-a', nullifierHash: nullifier, commitmentHash: '0x' + 'a'.repeat(64), metadataUri: 'ipfs://sample-vc' });
    const duplicate = registry.registerClaim({ programId: 'grant-a', nullifierHash: nullifier, commitmentHash: '0x' + 'b'.repeat(64), metadataUri: 'ipfs://second-vc' });

    expect(first.accepted).toBe(true);
    expect(duplicate.accepted).toBe(false);
    expect(duplicate.reason).toBe('DUPLICATE_CLAIM');
    expect(registry.auditEvents()).toHaveLength(2);
    expect(registry.stats()).toEqual({ totalClaims: 1, duplicateAttempts: 1, programs: 1 });
  });
});
