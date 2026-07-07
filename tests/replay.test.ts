// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { createNullifier, InMemoryClaimRegistry, type AuditEvent } from '../src/ledger.js';
import { computeStateRoot, replayAuditEvents, verifyLedgerReplay } from '../src/replay.js';

function seededRegistry(): InMemoryClaimRegistry {
  const registry = new InMemoryClaimRegistry();
  const aliceOss = createNullifier({ programId: 'osscontest-2026', subjectId: 'alice', salt: 's1' });
  const aliceScholarship = createNullifier({ programId: 'scholarship-2026', subjectId: 'alice', salt: 's1' });
  registry.registerClaim({
    programId: 'osscontest-2026',
    nullifierHash: aliceOss,
    commitmentHash: '0x' + 'a'.repeat(64),
    metadataUri: 'urn:claim:1'
  });
  registry.registerClaim({
    programId: 'osscontest-2026',
    nullifierHash: aliceOss,
    commitmentHash: '0x' + 'b'.repeat(64),
    metadataUri: 'urn:claim:2'
  });
  registry.registerClaim({
    programId: 'scholarship-2026',
    nullifierHash: aliceScholarship,
    commitmentHash: '0x' + 'c'.repeat(64),
    metadataUri: 'urn:claim:3'
  });
  return registry;
}

describe('Replay-Verify Engine', () => {
  it('replays audit events into the exact live registry state', () => {
    const registry = seededRegistry();
    const replayed = replayAuditEvents(registry.auditEvents());

    expect(replayed.stats).toEqual(registry.stats());
    expect(replayed.claims).toHaveLength(2);
    expect(replayed.perProgram['osscontest-2026']).toEqual({ claims: 1, duplicateAttempts: 1 });
    expect(replayed.perProgram['scholarship-2026']).toEqual({ claims: 1, duplicateAttempts: 0 });
  });

  it('produces a deterministic state root for identical event logs', () => {
    const registry = seededRegistry();
    const first = replayAuditEvents(registry.auditEvents());
    const second = replayAuditEvents(registry.auditEvents());

    expect(first.stateRoot).toBe(second.stateRoot);
    expect(first.stateRoot).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('verifies a healthy ledger as MATCH with equal state roots', () => {
    const registry = seededRegistry();
    const verification = verifyLedgerReplay(registry.auditEvents(), {
      claims: registry.allClaims(),
      stats: registry.stats()
    });

    expect(verification.match).toBe(true);
    expect(verification.divergences).toEqual([]);
    expect(verification.replayedStateRoot).toBe(verification.liveStateRoot);
  });

  it('flags forged duplicate events that precede any registration', () => {
    const registry = seededRegistry();
    const forged: AuditEvent[] = [
      {
        event: 'DuplicateDetected',
        programId: 'ghost-program',
        nullifierHash: '0x' + '9'.repeat(64),
        commitmentHash: '0x' + '9'.repeat(64),
        metadataUri: 'urn:forged',
        accepted: false,
        reason: 'DUPLICATE_CLAIM',
        timestamp: new Date().toISOString()
      },
      ...registry.auditEvents()
    ];

    const verification = verifyLedgerReplay(forged, {
      claims: registry.allClaims(),
      stats: registry.stats()
    });

    expect(verification.match).toBe(false);
    expect(verification.divergences.map((entry) => entry.code)).toContain('EVENT_ORDER_VIOLATION');
  });

  it('flags counter tampering in the live snapshot', () => {
    const registry = seededRegistry();
    const stats = registry.stats();
    const verification = verifyLedgerReplay(registry.auditEvents(), {
      claims: registry.allClaims(),
      stats: { ...stats, duplicateAttempts: stats.duplicateAttempts + 5 }
    });

    expect(verification.match).toBe(false);
    expect(verification.divergences.map((entry) => entry.code)).toContain('DUPLICATE_ATTEMPTS_MISMATCH');
  });

  it('flags a live claim whose commitment differs from the audited one', () => {
    const registry = seededRegistry();
    const claims = registry.allClaims().map((claim) =>
      claim.programId === 'scholarship-2026' ? { ...claim, commitmentHash: '0x' + 'd'.repeat(64) } : claim
    );

    const verification = verifyLedgerReplay(registry.auditEvents(), {
      claims,
      stats: registry.stats()
    });

    expect(verification.match).toBe(false);
    expect(verification.divergences.map((entry) => entry.code)).toContain('COMMITMENT_MISMATCH');
  });

  it('flags claims that exist live but never appear in the audit log', () => {
    const registry = seededRegistry();
    const smuggled = [
      ...registry.allClaims(),
      {
        programId: 'ghost-program',
        nullifierHash: '0x' + '8'.repeat(64),
        commitmentHash: '0x' + '8'.repeat(64),
        metadataUri: 'urn:smuggled',
        registeredAt: new Date().toISOString()
      }
    ];

    const verification = verifyLedgerReplay(registry.auditEvents(), {
      claims: smuggled,
      stats: registry.stats()
    });

    expect(verification.match).toBe(false);
    expect(verification.divergences.map((entry) => entry.code)).toContain('CLAIM_NOT_IN_REPLAY');
  });

  it('computes the state root independent of claim insertion order', () => {
    const claims = [
      {
        programId: 'b-program',
        nullifierHash: '0x' + '2'.repeat(64),
        commitmentHash: '0x' + '2'.repeat(64),
        metadataUri: 'urn:2'
      },
      {
        programId: 'a-program',
        nullifierHash: '0x' + '1'.repeat(64),
        commitmentHash: '0x' + '1'.repeat(64),
        metadataUri: 'urn:1'
      }
    ];
    const stats = { totalClaims: 2, duplicateAttempts: 0, programs: 2 };

    expect(computeStateRoot(claims, stats)).toBe(computeStateRoot([...claims].reverse(), stats));
  });
});
