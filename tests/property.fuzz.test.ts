// SPDX-License-Identifier: Apache-2.0
/**
 * Property-based fuzz suite (fast-check).
 *
 * The fixed red-team corpus asks "does attack X fail?"; this suite asks the
 * stronger question "does the invariant hold for *every* randomized case?".
 * Each property runs against a fresh randomized scenario on every CI run.
 */
import { createHash } from 'node:crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createNullifier,
  InMemoryClaimRegistry,
  type AuditEvent,
  type ClaimRecord,
  type RegistryStats
} from '../src/ledger.js';
import { verifyLedgerReplay } from '../src/replay.js';
import { computeIntegrityIndex } from '../src/integrityIndex.js';
import { deterministicTestKeyPair, issueCredential, verifyCredential } from '../src/vc.js';
import { createSchnorrNullifierProof, verifySchnorrNullifierProof } from '../src/zkProof.js';
import { buildMembershipProof, verifyMembershipProof } from '../src/nullifierProof.js';

const PROGRAMS = ['prog-alpha', 'prog-beta', 'prog-gamma'] as const;
const SUBJECTS = ['subject-1', 'subject-2', 'subject-3', 'subject-4'] as const;
const SALT = 'fuzz-agency-salt';
const ISSUER_DID = 'did:web:civicproof.example';
const VERIFY_AT = new Date('2026-07-01T00:00:00.000Z');

const labelArb = fc.string({ minLength: 1, maxLength: 24 }).filter((value) => value.trim().length > 0);
const opArb = fc.record({
  program: fc.constantFrom(...PROGRAMS),
  subject: fc.constantFrom(...SUBJECTS)
});
const opsArb = fc.array(opArb, { minLength: 1, maxLength: 40 });
const hex32Arb = fc.uint8Array({ minLength: 32, maxLength: 32 }).map((bytes) => `0x${Buffer.from(bytes).toString('hex')}`);

function fuzzCommitment(program: string, subject: string, attempt: number): string {
  return `0x${createHash('sha256').update(`fuzz-commitment:${program}:${subject}:${attempt}`).digest('hex')}`;
}

interface BuiltLedger {
  events: AuditEvent[];
  live: { claims: ClaimRecord[]; stats: RegistryStats };
}

function buildLedger(ops: ReadonlyArray<{ program: string; subject: string }>): BuiltLedger {
  const registry = new InMemoryClaimRegistry();
  ops.forEach((op, attempt) => {
    registry.registerClaim({
      programId: op.program,
      nullifierHash: createNullifier({ programId: op.program, subjectId: op.subject, salt: SALT }),
      commitmentHash: fuzzCommitment(op.program, op.subject, attempt),
      metadataUri: `urn:fuzz:claim:${attempt}`
    });
  });
  return { events: registry.auditEvents(), live: { claims: registry.allClaims(), stats: registry.stats() } };
}

describe('property: program-scoped nullifiers', () => {
  it('is deterministic and always a 32-byte hex string', () => {
    fc.assert(
      fc.property(labelArb, labelArb, labelArb, (programId, subjectId, salt) => {
        const first = createNullifier({ programId, subjectId, salt });
        const second = createNullifier({ programId, subjectId, salt });
        expect(second).toBe(first);
        expect(first).toMatch(/^0x[0-9a-f]{64}$/);
      })
    );
  });

  it('never repeats across different programs (cross-program unlinkability)', () => {
    fc.assert(
      fc.property(labelArb, labelArb, labelArb, (programA, programB, subjectId) => {
        fc.pre(programA !== programB);
        expect(createNullifier({ programId: programA, subjectId, salt: SALT })).not.toBe(
          createNullifier({ programId: programB, subjectId, salt: SALT })
        );
      })
    );
  });

  it('never collides for different subjects within one program', () => {
    fc.assert(
      fc.property(labelArb, labelArb, labelArb, (programId, subjectA, subjectB) => {
        fc.pre(subjectA !== subjectB);
        expect(createNullifier({ programId, subjectId: subjectA, salt: SALT })).not.toBe(
          createNullifier({ programId, subjectId: subjectB, salt: SALT })
        );
      })
    );
  });
});

describe('property: Replay-Verify engine', () => {
  it('round-trips every randomized ledger history back to a MATCH', () => {
    fc.assert(
      fc.property(opsArb, (ops) => {
        const { events, live } = buildLedger(ops);
        const verification = verifyLedgerReplay(events, live);
        expect(verification.match).toBe(true);
        expect(verification.divergences).toEqual([]);
        expect(verification.replayedStateRoot).toBe(verification.liveStateRoot);
      })
    );
  });

  it('detects every class of tampering with the log or the live state', () => {
    const tamperArb = fc.constantFrom(
      'drop-registered-event',
      'inflate-total-claims',
      'swap-live-commitment',
      'inject-order-violation',
      'remove-live-claim'
    );
    fc.assert(
      fc.property(opsArb, tamperArb, (ops, tamper) => {
        const { events, live } = buildLedger(ops);
        let tamperedEvents = events;
        let tamperedLive = live;

        switch (tamper) {
          case 'drop-registered-event': {
            const index = events.findIndex((event) => event.event === 'ClaimRegistered');
            tamperedEvents = [...events.slice(0, index), ...events.slice(index + 1)];
            break;
          }
          case 'inflate-total-claims': {
            tamperedLive = { ...live, stats: { ...live.stats, totalClaims: live.stats.totalClaims + 1 } };
            break;
          }
          case 'swap-live-commitment': {
            const original = live.claims[0];
            const forged = original.commitmentHash === `0x${'f'.repeat(64)}` ? `0x${'e'.repeat(64)}` : `0x${'f'.repeat(64)}`;
            tamperedLive = {
              ...live,
              claims: [{ ...original, commitmentHash: forged }, ...live.claims.slice(1)]
            };
            break;
          }
          case 'inject-order-violation': {
            tamperedEvents = [
              ...events,
              {
                event: 'DuplicateDetected',
                programId: 'ghost-program',
                nullifierHash: `0x${'9'.repeat(64)}`,
                commitmentHash: `0x${'9'.repeat(64)}`,
                metadataUri: 'urn:fuzz:forged',
                accepted: false,
                reason: 'DUPLICATE_CLAIM',
                timestamp: '2026-07-01T00:00:00.000Z'
              }
            ];
            break;
          }
          case 'remove-live-claim': {
            tamperedLive = { ...live, claims: live.claims.slice(1) };
            break;
          }
        }

        const verification = verifyLedgerReplay(tamperedEvents, tamperedLive);
        expect(verification.match).toBe(false);
        expect(verification.divergences.length).toBeGreaterThan(0);
      })
    );
  });
});

describe('property: verifiable credentials', () => {
  const issuerKeys = deterministicTestKeyPair('civicproof-fuzz-issuer');
  const verifyOptions = { issuerDid: ISSUER_DID, publicKeyHex: issuerKeys.publicKeyHex, at: VERIFY_AT };

  async function issueFor(programId: string, subjectId: string, expiresAt = '2099-01-01T00:00:00.000Z') {
    return issueCredential(
      {
        issuerDid: ISSUER_DID,
        subjectDid: 'did:key:fuzz-subject',
        programId,
        nullifierHash: createNullifier({ programId, subjectId, salt: SALT }),
        commitmentHash: fuzzCommitment(programId, subjectId, 0),
        expiresAt
      },
      issuerKeys
    );
  }

  it('accepts every honestly issued credential', async () => {
    await fc.assert(
      fc.asyncProperty(labelArb, labelArb, async (programId, subjectId) => {
        const credential = await issueFor(programId, subjectId);
        expect(await verifyCredential(credential, verifyOptions)).toEqual({ valid: true });
      }),
      { numRuns: 20 }
    );
  });

  it('rejects every single-field mutation of a signed credential', async () => {
    const fieldArb = fc.constantFrom('programId', 'nullifierHash', 'commitmentHash', 'expirationDate');
    await fc.assert(
      fc.asyncProperty(labelArb, labelArb, fieldArb, async (programId, subjectId, field) => {
        const credential = await issueFor(programId, subjectId);
        if (field === 'expirationDate') {
          credential.expirationDate = '2098-01-01T00:00:00.000Z';
        } else if (field === 'programId') {
          credential.credentialSubject.programId = `${credential.credentialSubject.programId}-x`;
        } else {
          const current = credential.credentialSubject[field];
          const flipped = current[2] === '0' ? '1' : '0';
          credential.credentialSubject[field] = `0x${flipped}${current.slice(3)}`;
        }
        const verification = await verifyCredential(credential, verifyOptions);
        expect(verification.valid).toBe(false);
      }),
      { numRuns: 20 }
    );
  });

  it('rejects every expired credential with reason EXPIRED', async () => {
    await fc.assert(
      fc.asyncProperty(labelArb, labelArb, async (programId, subjectId) => {
        const credential = await issueFor(programId, subjectId, '2025-01-01T00:00:00.000Z');
        expect(await verifyCredential(credential, verifyOptions)).toEqual({ valid: false, reason: 'EXPIRED' });
      }),
      { numRuns: 10 }
    );
  });
});

describe('property: proof primitives', () => {
  it('Schnorr NIZK verifies honest proofs and rejects mutated responses', () => {
    fc.assert(
      fc.property(labelArb, labelArb, (subjectSecret, programId) => {
        const proof = createSchnorrNullifierProof({ subjectSecret, programId });
        expect(verifySchnorrNullifierProof(proof)).toBe(true);
        const forged = { ...proof, response: (BigInt(proof.response) + 1n).toString() };
        expect(verifySchnorrNullifierProof(forged)).toBe(false);
      }),
      { numRuns: 10 }
    );
  });

  it('Merkle membership proofs verify for members and fail for forged siblings', () => {
    const leavesArb = fc
      .array(hex32Arb, { minLength: 2, maxLength: 12 })
      .map((leaves) => [...new Set(leaves.map((leaf) => leaf.toLowerCase()))])
      .filter((leaves) => leaves.length >= 2);
    fc.assert(
      fc.property(leavesArb, fc.nat(), (leaves, seed) => {
        const target = leaves[seed % leaves.length];
        const proof = buildMembershipProof(leaves, target);
        expect(verifyMembershipProof(proof)).toBe(true);

        const forgedSibling = proof.siblings[0] === `0x${'d'.repeat(64)}` ? `0x${'c'.repeat(64)}` : `0x${'d'.repeat(64)}`;
        const forged = { ...proof, siblings: [forgedSibling, ...proof.siblings.slice(1)] };
        expect(verifyMembershipProof(forged)).toBe(false);
      }),
      { numRuns: 50 }
    );
  });
});

describe('property: civic integrity index', () => {
  it('is deterministic, bounded to [0,100], and 100 only for fully healthy input', () => {
    const checksArb = fc
      .record({ total: fc.nat({ max: 5 }), valid: fc.nat({ max: 5 }) })
      .map(({ total, valid }) => ({ total, validSignatures: Math.min(total, valid) }));
    fc.assert(
      fc.property(opsArb, fc.boolean(), checksArb, fc.constantFrom(0, 1, 3), (ops, replayMatch, credentialChecks, piiFieldsOnLedger) => {
        const { events } = buildLedger(ops);
        const input = { events, replayMatch, credentialChecks, piiFieldsOnLedger };
        const first = computeIntegrityIndex(input);
        const second = computeIntegrityIndex(input);
        expect(second).toEqual(first);
        expect(first.score).toBeGreaterThanOrEqual(0);
        expect(first.score).toBeLessThanOrEqual(100);
        if (!replayMatch) {
          expect(first.score).toBeLessThanOrEqual(60);
          expect(first.subscores.auditConsistency).toBe(0);
        }
        const fullyHealthy =
          replayMatch && piiFieldsOnLedger === 0 && credentialChecks.validSignatures === credentialChecks.total;
        if (first.score === 100) {
          expect(fullyHealthy).toBe(true);
        }
        if (fullyHealthy) {
          expect(first.score).toBe(100);
        }
      })
    );
  });
});
