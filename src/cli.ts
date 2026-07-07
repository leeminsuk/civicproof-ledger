// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { createNullifier, type AuditEvent } from './ledger.js';
import {
  deterministicTestKeyPair,
  issueCredential,
  verifyCredential,
  type CivicProofCredential,
  type CredentialVerification
} from './vc.js';
import { replayAuditEvents, type ProgramReplaySummary } from './replay.js';
import { computeIntegrityIndex, type IntegrityIndex } from './integrityIndex.js';
import { runDemoScenario } from './demo.js';
import { runAttackCorpus } from './attackCorpus.js';

const DEFAULT_ISSUER_DID = 'did:web:civicproof.example';
const DEFAULT_ISSUER_LABEL = 'civicproof-demo-issuer';

/** Keys a public audit event may carry. Anything else is a privacy-lint finding. */
export const AUDIT_EVENT_ALLOWED_KEYS: readonly string[] = Object.freeze([
  'event',
  'programId',
  'nullifierHash',
  'commitmentHash',
  'metadataUri',
  'accepted',
  'timestamp',
  'reason'
]);

export interface ScenarioInput {
  events: AuditEvent[];
  credentialChecks?: { total: number; validSignatures: number };
  piiFieldsOnLedger?: number;
}

export interface ReplayReport {
  stateRoot: string;
  totalClaims: number;
  duplicateAttempts: number;
  programs: number;
  perProgram: Record<string, ProgramReplaySummary>;
  orderViolations: string[];
  unexpectedFields: string[];
  consistent: boolean;
}

/** Accepts either a bare audit-event array or a `{ events, ... }` scenario object. */
export function parseScenario(raw: string): ScenarioInput {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new Error(`scenario file is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const container = Array.isArray(value) ? { events: value } : (value as Record<string, unknown>);
  if (!container || !Array.isArray((container as { events?: unknown }).events)) {
    throw new Error('scenario must be an audit-event array or an object with an "events" array');
  }

  const events = (container as { events: unknown[] }).events.map((entry, index) => validateEvent(entry, index));
  const scenario: ScenarioInput = { events };

  const checks = (container as { credentialChecks?: unknown }).credentialChecks;
  if (checks && typeof checks === 'object') {
    const { total, validSignatures } = checks as { total?: unknown; validSignatures?: unknown };
    if (typeof total === 'number' && typeof validSignatures === 'number') {
      scenario.credentialChecks = { total, validSignatures };
    }
  }
  const pii = (container as { piiFieldsOnLedger?: unknown }).piiFieldsOnLedger;
  if (typeof pii === 'number') {
    scenario.piiFieldsOnLedger = pii;
  }
  return scenario;
}

function validateEvent(entry: unknown, index: number): AuditEvent {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(`events[${index}] must be an object`);
  }
  const candidate = entry as Record<string, unknown>;
  if (candidate.event !== 'ClaimRegistered' && candidate.event !== 'DuplicateDetected') {
    throw new Error(`events[${index}].event must be ClaimRegistered or DuplicateDetected`);
  }
  for (const field of ['programId', 'nullifierHash', 'commitmentHash', 'metadataUri', 'timestamp'] as const) {
    if (typeof candidate[field] !== 'string' || (candidate[field] as string).length === 0) {
      throw new Error(`events[${index}].${field} must be a non-empty string`);
    }
  }
  if (typeof candidate.accepted !== 'boolean') {
    throw new Error(`events[${index}].accepted must be a boolean`);
  }
  return entry as AuditEvent;
}

export function loadScenario(path: string): ScenarioInput {
  return parseScenario(readFileSync(path, 'utf8'));
}

/** DuplicateDetected events whose claim was never registered earlier in the log. */
export function findOrderViolations(events: AuditEvent[]): string[] {
  const seen = new Set<string>();
  const violations: string[] = [];
  for (const event of events) {
    const key = `${event.programId}:${event.nullifierHash.toLowerCase()}`;
    if (event.event === 'DuplicateDetected' && !seen.has(key)) {
      violations.push(key);
    }
    if (event.event === 'ClaimRegistered') {
      seen.add(key);
    }
  }
  return violations;
}

/** Privacy lint: field names on public events outside the documented schema. */
export function auditUnexpectedFields(events: AuditEvent[]): string[] {
  const findings: string[] = [];
  events.forEach((event, index) => {
    for (const key of Object.keys(event)) {
      if (!AUDIT_EVENT_ALLOWED_KEYS.includes(key)) {
        findings.push(`event[${index}].${key}`);
      }
    }
  });
  return findings;
}

export function replayScenario(scenario: ScenarioInput): ReplayReport {
  const replayed = replayAuditEvents(scenario.events);
  const orderViolations = findOrderViolations(scenario.events);
  const unexpectedFields = auditUnexpectedFields(scenario.events);
  return {
    stateRoot: replayed.stateRoot,
    totalClaims: replayed.stats.totalClaims,
    duplicateAttempts: replayed.stats.duplicateAttempts,
    programs: replayed.stats.programs,
    perProgram: replayed.perProgram,
    orderViolations,
    unexpectedFields,
    consistent: orderViolations.length === 0
  };
}

export function scoreScenario(scenario: ScenarioInput): IntegrityIndex {
  const orderViolations = findOrderViolations(scenario.events);
  const unexpectedFields = auditUnexpectedFields(scenario.events);
  return computeIntegrityIndex({
    events: scenario.events,
    replayMatch: orderViolations.length === 0,
    credentialChecks: scenario.credentialChecks ?? { total: 0, validSignatures: 0 },
    piiFieldsOnLedger: scenario.piiFieldsOnLedger ?? unexpectedFields.length
  });
}

export function demoCommitment(programId: string, subjectId: string, salt: string): string {
  const digest = createHash('sha256')
    .update('civicproof:commitment:demo:v1')
    .update('\0')
    .update(programId)
    .update('\0')
    .update(subjectId)
    .update('\0')
    .update(salt)
    .digest('hex');
  return `0x${digest}`;
}

export interface IssueDemoCredentialOptions {
  program: string;
  subject: string;
  salt: string;
  expires?: string;
  issuerLabel?: string;
  issuerDid?: string;
  subjectDid?: string;
}

/** Issues a credential with a deterministic demo issuer key (never use these keys in production). */
export async function issueDemoCredential(options: IssueDemoCredentialOptions): Promise<CivicProofCredential> {
  const issuerKeys = deterministicTestKeyPair(options.issuerLabel ?? DEFAULT_ISSUER_LABEL);
  const nullifierHash = createNullifier({
    programId: options.program,
    subjectId: options.subject,
    salt: options.salt
  });
  return issueCredential(
    {
      issuerDid: options.issuerDid ?? DEFAULT_ISSUER_DID,
      subjectDid: options.subjectDid ?? 'did:key:redacted-subject',
      programId: options.program,
      nullifierHash,
      commitmentHash: demoCommitment(options.program, options.subject, options.salt),
      expiresAt: options.expires ?? '2027-12-31T00:00:00.000Z'
    },
    issuerKeys
  );
}

export interface VerifyFileOptions {
  issuerDid?: string;
  issuerLabel?: string;
  publicKeyHex?: string;
  at?: Date;
}

export async function verifyCredentialFile(
  path: string,
  options: VerifyFileOptions = {}
): Promise<{ credential: CivicProofCredential; verification: CredentialVerification }> {
  const credential = JSON.parse(readFileSync(path, 'utf8')) as CivicProofCredential;
  const publicKeyHex =
    options.publicKeyHex ?? deterministicTestKeyPair(options.issuerLabel ?? DEFAULT_ISSUER_LABEL).publicKeyHex;
  const verification = await verifyCredential(credential, {
    issuerDid: options.issuerDid ?? DEFAULT_ISSUER_DID,
    publicKeyHex,
    at: options.at
  });
  return { credential, verification };
}

export function buildProgram(): Command {
  const program = new Command()
    .name('civicproof')
    .description('CivicProof Ledger toolkit: issue/verify credentials, replay audit logs, score integrity.');

  program
    .command('issue')
    .description('Issue a demo Ed25519 credential with a program-scoped nullifier (deterministic demo issuer key).')
    .requiredOption('--program <id>', 'program identifier, e.g. osscontest-2026')
    .requiredOption('--subject <id>', 'subject identifier kept off-chain (only its nullifier is derived)')
    .option('--salt <salt>', 'issuer-local salt', 'demo-agency-secret')
    .option('--expires <iso>', 'expiration timestamp (ISO-8601)')
    .option('--issuer-label <label>', 'deterministic demo issuer key label', DEFAULT_ISSUER_LABEL)
    .option('--issuer-did <did>', 'issuer DID', DEFAULT_ISSUER_DID)
    .option('--subject-did <did>', 'subject DID placed in the credential', 'did:key:redacted-subject')
    .action(async (options: { program: string; subject: string; salt: string; expires?: string; issuerLabel: string; issuerDid: string; subjectDid: string }) => {
      const credential = await issueDemoCredential({
        program: options.program,
        subject: options.subject,
        salt: options.salt,
        expires: options.expires,
        issuerLabel: options.issuerLabel,
        issuerDid: options.issuerDid,
        subjectDid: options.subjectDid
      });
      console.log(JSON.stringify(credential, null, 2));
    });

  program
    .command('verify')
    .description('Verify a credential JSON file (signature, issuer, expiration). Exit code 1 when invalid.')
    .argument('<file>', 'credential JSON file')
    .option('--issuer-did <did>', 'expected issuer DID', DEFAULT_ISSUER_DID)
    .option('--issuer-label <label>', 'deterministic demo issuer key label', DEFAULT_ISSUER_LABEL)
    .option('--public-key <hex>', 'issuer public key (64 hex chars); overrides --issuer-label')
    .option('--at <iso>', 'verification time (ISO-8601, defaults to now)')
    .option('--json', 'print the verification result as JSON')
    .action(async (file: string, options: { issuerDid: string; issuerLabel: string; publicKey?: string; at?: string; json?: boolean }) => {
      const { verification } = await verifyCredentialFile(file, {
        issuerDid: options.issuerDid,
        issuerLabel: options.issuerLabel,
        publicKeyHex: options.publicKey,
        at: options.at ? new Date(options.at) : undefined
      });
      if (options.json) {
        console.log(JSON.stringify(verification, null, 2));
      } else {
        console.log(verification.valid ? 'VALID credential' : `INVALID credential: ${verification.reason}`);
      }
      if (!verification.valid) {
        process.exitCode = 1;
      }
    });

  program
    .command('replay')
    .description('Rebuild ledger state from an audit-event log and report the deterministic state root. Exit code 1 on order violations.')
    .argument('<file>', 'scenario JSON: audit-event array or { "events": [...] }')
    .option('--json', 'print the replay report as JSON')
    .action((file: string, options: { json?: boolean }) => {
      const report = replayScenario(loadScenario(file));
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(`State root: ${report.stateRoot}`);
        console.log(`Accepted claims: ${report.totalClaims}`);
        console.log(`Duplicate attempts: ${report.duplicateAttempts}`);
        console.log(`Programs: ${report.programs}`);
        console.log(`Order violations: ${report.orderViolations.length === 0 ? 'none' : report.orderViolations.join(', ')}`);
        console.log(`Unexpected event fields: ${report.unexpectedFields.length === 0 ? 'none' : report.unexpectedFields.join(', ')}`);
        console.log(report.consistent ? 'REPLAY CONSISTENT' : 'REPLAY DIVERGED');
      }
      if (!report.consistent) {
        process.exitCode = 1;
      }
    });

  program
    .command('cii')
    .description('Compute the deterministic Civic Integrity Index (cii-v1) for a scenario file.')
    .argument('<file>', 'scenario JSON: audit-event array or { "events", "credentialChecks", "piiFieldsOnLedger" }')
    .option('--json', 'print the full index as JSON')
    .action((file: string, options: { json?: boolean }) => {
      const index = scoreScenario(loadScenario(file));
      if (options.json) {
        console.log(JSON.stringify(index, null, 2));
      } else {
        console.log(`Civic Integrity Index (${index.formula}): ${index.score}/100 ${index.grade}`);
        console.log(
          `Subscores — audit ${index.subscores.auditConsistency}/40, duplicates ${index.subscores.duplicateContainment}/30, credentials ${index.subscores.credentialIntegrity}/20, privacy ${index.subscores.privacyMinimization}/10`
        );
      }
    });

  program
    .command('demo')
    .description('Run the built-in end-to-end demo scenario.')
    .option('--json', 'print the full result as JSON')
    .action(async (options: { json?: boolean }) => {
      const result = await runDemoScenario();
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result.publicAuditSummary);
      }
    });

  program
    .command('redteam')
    .description('Run the 12-scenario red-team attack corpus. Exit code 1 unless 100% are blocked.')
    .option('--json', 'print the full report as JSON')
    .action(async (options: { json?: boolean }) => {
      const report = await runAttackCorpus();
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        for (const result of report.results) {
          console.log(`${result.blocked ? 'BLOCKED' : 'LEAKED '} ${result.id} [${result.category}] ${result.name}`);
        }
        console.log(`Blocked ${report.blocked}/${report.total} attacks`);
      }
      if (!report.allBlocked) {
        process.exitCode = 1;
      }
    });

  return program;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildProgram().parseAsync(process.argv);
}
