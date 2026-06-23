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

  it('allows the same subject-derived nullifier material in a separate program scope', () => {
    const registry = new InMemoryClaimRegistry();
    const subjectId = 'applicant-1';
    const salt = 's1';
    const grantA = createNullifier({ programId: 'grant-a', subjectId, salt });
    const grantB = createNullifier({ programId: 'grant-b', subjectId, salt });

    expect(registry.registerClaim({ programId: 'grant-a', nullifierHash: grantA, commitmentHash: '0x' + 'a'.repeat(64), metadataUri: 'ipfs://a' }).accepted).toBe(true);
    expect(registry.registerClaim({ programId: 'grant-b', nullifierHash: grantB, commitmentHash: '0x' + 'b'.repeat(64), metadataUri: 'ipfs://b' }).accepted).toBe(true);
    expect(registry.stats()).toEqual({ totalClaims: 2, duplicateAttempts: 0, programs: 2 });
  });

  it('normalizes nullifier case for duplicate detection', () => {
    const registry = new InMemoryClaimRegistry();
    const lower = '0x' + 'a'.repeat(64);
    const upper = `0x${'A'.repeat(64)}`;

    expect(registry.registerClaim({ programId: 'grant-a', nullifierHash: lower, commitmentHash: '0x' + 'b'.repeat(64), metadataUri: 'ipfs://first' }).accepted).toBe(true);
    expect(registry.registerClaim({ programId: 'grant-a', nullifierHash: upper, commitmentHash: '0x' + 'c'.repeat(64), metadataUri: 'ipfs://duplicate' })).toMatchObject({
      accepted: false,
      reason: 'DUPLICATE_CLAIM'
    });
  });

  it('rejects malformed nullifier hashes before mutating audit state', () => {
    const registry = new InMemoryClaimRegistry();

    expect(() => registry.registerClaim({ programId: 'grant-a', nullifierHash: 'bad', commitmentHash: '0x' + 'b'.repeat(64), metadataUri: 'ipfs://first' })).toThrow('nullifierHash');
    expect(registry.auditEvents()).toHaveLength(0);
    expect(registry.stats()).toEqual({ totalClaims: 0, duplicateAttempts: 0, programs: 0 });
  });

  it('rejects malformed commitment hashes before mutating audit state', () => {
    const registry = new InMemoryClaimRegistry();

    expect(() => registry.registerClaim({ programId: 'grant-a', nullifierHash: '0x' + 'a'.repeat(64), commitmentHash: 'bad', metadataUri: 'ipfs://first' })).toThrow('commitmentHash');
    expect(registry.auditEvents()).toHaveLength(0);
  });

  it('rejects empty program ids and metadata URIs', () => {
    const registry = new InMemoryClaimRegistry();

    expect(() => registry.registerClaim({ programId: '', nullifierHash: '0x' + 'a'.repeat(64), commitmentHash: '0x' + 'b'.repeat(64), metadataUri: 'ipfs://first' })).toThrow('programId');
    expect(() => registry.registerClaim({ programId: 'grant-a', nullifierHash: '0x' + 'a'.repeat(64), commitmentHash: '0x' + 'b'.repeat(64), metadataUri: '' })).toThrow('metadataUri');
  });

  it('returns immutable audit event snapshots', () => {
    const registry = new InMemoryClaimRegistry();
    registry.registerClaim({ programId: 'grant-a', nullifierHash: '0x' + 'a'.repeat(64), commitmentHash: '0x' + 'b'.repeat(64), metadataUri: 'ipfs://first' });

    const events = registry.auditEvents();
    events[0].programId = 'mutated';
    events.push({ ...events[0], programId: 'extra' });

    expect(registry.auditEvents()).toHaveLength(1);
    expect(registry.auditEvents()[0].programId).toBe('grant-a');
  });

  it('reads accepted claims without exposing duplicate attempt payloads as records', () => {
    const registry = new InMemoryClaimRegistry();
    const first = { programId: 'grant-a', nullifierHash: '0x' + 'a'.repeat(64), commitmentHash: '0x' + 'b'.repeat(64), metadataUri: 'ipfs://first' };
    registry.registerClaim(first);
    registry.registerClaim({ ...first, commitmentHash: '0x' + 'c'.repeat(64), metadataUri: 'ipfs://duplicate' });

    expect(registry.getClaim('grant-a', first.nullifierHash)).toMatchObject(first);
    expect(registry.getClaim('grant-a', '0x' + 'd'.repeat(64))).toBeUndefined();
  });
});
