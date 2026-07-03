import type { AuditEvent } from '../src/ledger.js';
import type { CivicProofCredential } from '../src/vc.js';

export interface WebVerifierOptions {
  issuerDid: string;
  publicKeyHex: string;
  seenNullifiers: Set<string>;
  at?: Date;
}

export interface WebVerifierResult {
  status: 'normal' | 'duplicate' | 'expired' | 'tampered';
  message: string;
  reason?: string;
  duplicateKey?: string;
}

export interface WebAuditMetrics {
  acceptedClaims: number;
  duplicateAttempts: number;
  programs: number;
  piiFieldsStored: number;
}

export const demoIssuer: {
  did: string;
  privateKeyHex: string;
  publicKeyHex: string;
};

export function verifyCredentialPaste(jsonText: string, options: WebVerifierOptions): Promise<WebVerifierResult>;
export function buildAuditMetrics(events: AuditEvent[]): WebAuditMetrics;
export function demoScenario(): Promise<{
  credentials: CivicProofCredential[];
  verifierResults: WebVerifierResult[];
  events: AuditEvent[];
  metrics: WebAuditMetrics;
  sampleCredentialJson: string;
}>;

export interface WebReplayResult {
  match: boolean;
  derived: WebAuditMetrics;
  orderViolations: string[];
}

export interface WebIntegrityIndex {
  formula: 'cii-v1';
  score: number;
  grade: 'EXCELLENT' | 'GOOD' | 'WATCH' | 'ALERT';
  subscores: {
    auditConsistency: number;
    duplicateContainment: number;
    credentialIntegrity: number;
    privacyMinimization: number;
  };
}

export function replayFromEvents(events: AuditEvent[], claimedMetrics: WebAuditMetrics): WebReplayResult;
export function computeIntegrityIndex(
  events: AuditEvent[],
  options: {
    replayMatch: boolean;
    credentialChecks: { total: number; validSignatures: number };
    piiFieldsOnLedger: number;
  }
): WebIntegrityIndex;
