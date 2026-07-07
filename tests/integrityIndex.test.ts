// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import type { AuditEvent } from '../src/ledger.js';
import { CII_WEIGHTS, computeIntegrityIndex, gradeForScore } from '../src/integrityIndex.js';

function event(partial: Partial<AuditEvent> & Pick<AuditEvent, 'event' | 'accepted'>): AuditEvent {
  return {
    programId: 'osscontest-2026',
    nullifierHash: '0x' + '1'.repeat(64),
    commitmentHash: '0x' + '1'.repeat(64),
    metadataUri: 'urn:claim',
    timestamp: '2026-07-01T00:00:00.000Z',
    ...partial
  };
}

describe('Civic Integrity Index (cii-v1)', () => {
  it('scores a fully healthy ledger as 100 EXCELLENT', () => {
    const index = computeIntegrityIndex({
      events: [
        event({ event: 'ClaimRegistered', accepted: true }),
        event({ event: 'DuplicateDetected', accepted: false, reason: 'DUPLICATE_CLAIM' })
      ],
      replayMatch: true,
      credentialChecks: { total: 3, validSignatures: 3 },
      piiFieldsOnLedger: 0
    });

    expect(index.formula).toBe('cii-v1');
    expect(index.score).toBe(100);
    expect(index.grade).toBe('EXCELLENT');
    expect(index.subscores).toEqual({
      auditConsistency: 40,
      duplicateContainment: 30,
      credentialIntegrity: 20,
      privacyMinimization: 10
    });
  });

  it('is deterministic: identical input yields the identical index', () => {
    const input = {
      events: [event({ event: 'ClaimRegistered', accepted: true })],
      replayMatch: true,
      credentialChecks: { total: 2, validSignatures: 1 },
      piiFieldsOnLedger: 0
    };

    expect(computeIntegrityIndex(input)).toEqual(computeIntegrityIndex(input));
  });

  it('zeroes audit consistency when replay verification diverges', () => {
    const index = computeIntegrityIndex({
      events: [event({ event: 'ClaimRegistered', accepted: true })],
      replayMatch: false,
      credentialChecks: { total: 1, validSignatures: 1 },
      piiFieldsOnLedger: 0
    });

    expect(index.subscores.auditConsistency).toBe(0);
    expect(index.score).toBe(60);
    expect(index.grade).toBe('WATCH');
  });

  it('scales credential integrity by the valid-signature share', () => {
    const index = computeIntegrityIndex({
      events: [event({ event: 'ClaimRegistered', accepted: true })],
      replayMatch: true,
      credentialChecks: { total: 4, validSignatures: 3 },
      piiFieldsOnLedger: 0
    });

    expect(index.subscores.credentialIntegrity).toBe(15);
    expect(index.score).toBe(95);
  });

  it('zeroes privacy minimization when PII appears on the ledger', () => {
    const index = computeIntegrityIndex({
      events: [event({ event: 'ClaimRegistered', accepted: true })],
      replayMatch: true,
      credentialChecks: { total: 1, validSignatures: 1 },
      piiFieldsOnLedger: 2
    });

    expect(index.subscores.privacyMinimization).toBe(0);
    expect(index.score).toBe(90);
  });

  it('reports per-program duplicate pressure', () => {
    const index = computeIntegrityIndex({
      events: [
        event({ event: 'ClaimRegistered', accepted: true, programId: 'osscontest-2026' }),
        event({ event: 'DuplicateDetected', accepted: false, reason: 'DUPLICATE_CLAIM', programId: 'osscontest-2026' }),
        event({ event: 'ClaimRegistered', accepted: true, programId: 'scholarship-2026' })
      ],
      replayMatch: true,
      credentialChecks: { total: 3, validSignatures: 3 },
      piiFieldsOnLedger: 0
    });

    expect(index.perProgram['osscontest-2026']).toEqual({
      accepted: 1,
      duplicateAttempts: 1,
      duplicatePressure: 50
    });
    expect(index.perProgram['scholarship-2026']).toEqual({
      accepted: 1,
      duplicateAttempts: 0,
      duplicatePressure: 0
    });
  });

  it('keeps weights frozen at the documented cii-v1 split', () => {
    expect(CII_WEIGHTS).toEqual({
      auditConsistency: 40,
      duplicateContainment: 30,
      credentialIntegrity: 20,
      privacyMinimization: 10
    });
  });

  it('maps scores to deterministic grades at fixed thresholds', () => {
    expect(gradeForScore(100)).toBe('EXCELLENT');
    expect(gradeForScore(90)).toBe('EXCELLENT');
    expect(gradeForScore(89)).toBe('GOOD');
    expect(gradeForScore(75)).toBe('GOOD');
    expect(gradeForScore(74)).toBe('WATCH');
    expect(gradeForScore(50)).toBe('WATCH');
    expect(gradeForScore(49)).toBe('ALERT');
    expect(gradeForScore(0)).toBe('ALERT');
  });
});
