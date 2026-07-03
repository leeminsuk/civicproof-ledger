import type { AuditEvent } from '../src/ledger.js';

export interface Citizen {
  id: string;
  label: string;
  color: string;
}
export interface Program {
  id: string;
  label: string;
  budget: string;
}
export const CITIZENS: Citizen[];
export const PROGRAMS: Program[];

export interface SubmitResult {
  status: 'accepted' | 'duplicate';
  signatureValid: boolean;
  citizenId: string;
  programId: string;
  citizenLabel: string;
  programLabel: string;
  nullifierHash: string;
  commitmentHash: string;
  event: AuditEvent;
}

export interface SimMetrics {
  acceptedClaims: number;
  duplicateAttempts: number;
  programs: number;
  piiFieldsStored: number;
}

export interface ReplayResult {
  match: boolean;
  derived: SimMetrics;
  orderViolations: string[];
}

export interface IntegrityIndex {
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

export interface ProgramPressure {
  programId: string;
  label: string;
  accepted: number;
  duplicates: number;
  pressure: number;
}

export interface AuditProofs {
  metrics: SimMetrics;
  replay: ReplayResult;
  index: IntegrityIndex;
  perProgram: ProgramPressure[];
}

export interface Simulator {
  submit(citizenId: string, programId: string): Promise<SubmitResult>;
  metrics(): SimMetrics;
  auditProofs(): AuditProofs;
  snapshot(): { events: AuditEvent[]; claims: string[] };
  reset(): void;
  events: AuditEvent[];
}

export interface ScenarioStep {
  citizenId: string;
  programId: string;
  caption: string;
}

export interface AttackResult {
  id: string;
  name: string;
  category: 'credential' | 'ledger' | 'proof' | 'audit-log' | 'privacy';
  defense: string;
  observed: string;
  blocked: boolean;
}
export interface AttackReport {
  protocol: 'civicproof-redteam-v1';
  total: number;
  blocked: number;
  allBlocked: boolean;
  results: AttackResult[];
}

export function citizenLabel(id: string): string;
export function programLabel(id: string): string;
export function createSimulator(): Simulator;
export function perProgramPressure(events: AuditEvent[]): ProgramPressure[];
export const SCRIPTED_SCENARIO: ScenarioStep[];
export function runAttackCorpus(): Promise<AttackReport>;
export function tamperEvents(events: AuditEvent[]): AuditEvent[];
export function auditProofsFor(events: AuditEvent[]): AuditProofs;
