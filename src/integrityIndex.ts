// SPDX-License-Identifier: Apache-2.0
import type { AuditEvent } from './ledger.js';

export interface CredentialCheckSummary {
  total: number;
  validSignatures: number;
}

export interface IntegrityIndexInput {
  events: AuditEvent[];
  replayMatch: boolean;
  credentialChecks: CredentialCheckSummary;
  piiFieldsOnLedger: number;
}

export interface IntegritySubscores {
  auditConsistency: number;
  duplicateContainment: number;
  credentialIntegrity: number;
  privacyMinimization: number;
}

export type IntegrityGrade = 'EXCELLENT' | 'GOOD' | 'WATCH' | 'ALERT';

export interface IntegrityIndex {
  formula: 'cii-v1';
  score: number;
  grade: IntegrityGrade;
  subscores: IntegritySubscores;
  perProgram: Record<string, ProgramIntegrity>;
}

export interface ProgramIntegrity {
  accepted: number;
  duplicateAttempts: number;
  duplicatePressure: number;
}

export const CII_WEIGHTS = Object.freeze({
  auditConsistency: 40,
  duplicateContainment: 30,
  credentialIntegrity: 20,
  privacyMinimization: 10
});

/**
 * Civic Integrity Index (CII) v1.
 *
 * A deterministic 0-100 score with fixed weights. No model, no randomness:
 * the same ledger snapshot always yields the same score, so two independent
 * auditors can reproduce the exact number from public data alone.
 *
 * - auditConsistency (40): the audit-event log replays to the exact live
 *   ledger state (Replay-Verify Engine result).
 * - duplicateContainment (30): every duplicate attempt was rejected and left
 *   an audit event instead of overwriting the original claim.
 * - credentialIntegrity (20): share of presented credentials whose Ed25519
 *   signatures verified against the issuer key.
 * - privacyMinimization (10): the public ledger stores zero PII fields.
 */
export function computeIntegrityIndex(input: IntegrityIndexInput): IntegrityIndex {
  const accepted = input.events.filter((event) => event.accepted);
  const duplicates = input.events.filter((event) => !event.accepted);
  const blockedDuplicates = duplicates.filter((event) => event.reason === 'DUPLICATE_CLAIM');

  const auditConsistency = input.replayMatch ? CII_WEIGHTS.auditConsistency : 0;
  const duplicateContainment =
    duplicates.length === 0
      ? CII_WEIGHTS.duplicateContainment
      : Math.round(CII_WEIGHTS.duplicateContainment * (blockedDuplicates.length / duplicates.length));
  const credentialIntegrity =
    input.credentialChecks.total === 0
      ? CII_WEIGHTS.credentialIntegrity
      : Math.round(
          CII_WEIGHTS.credentialIntegrity *
            (input.credentialChecks.validSignatures / input.credentialChecks.total)
        );
  const privacyMinimization = input.piiFieldsOnLedger === 0 ? CII_WEIGHTS.privacyMinimization : 0;

  const subscores: IntegritySubscores = {
    auditConsistency,
    duplicateContainment,
    credentialIntegrity,
    privacyMinimization
  };
  const score = auditConsistency + duplicateContainment + credentialIntegrity + privacyMinimization;

  const perProgram: Record<string, ProgramIntegrity> = {};
  for (const event of input.events) {
    const program = (perProgram[event.programId] ??= {
      accepted: 0,
      duplicateAttempts: 0,
      duplicatePressure: 0
    });
    if (event.accepted) {
      program.accepted += 1;
    } else {
      program.duplicateAttempts += 1;
    }
  }
  for (const program of Object.values(perProgram)) {
    const total = program.accepted + program.duplicateAttempts;
    program.duplicatePressure = total === 0 ? 0 : Math.round((program.duplicateAttempts / total) * 100);
  }

  return {
    formula: 'cii-v1',
    score,
    grade: gradeForScore(score),
    subscores,
    perProgram
  };
}

export function gradeForScore(score: number): IntegrityGrade {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 75) return 'GOOD';
  if (score >= 50) return 'WATCH';
  return 'ALERT';
}
