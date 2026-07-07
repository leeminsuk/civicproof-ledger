// SPDX-License-Identifier: Apache-2.0
import { Command } from 'commander';
import { createNullifier, InMemoryClaimRegistry, type AuditEvent, type RegistryStats } from './ledger.js';
import { deterministicTestKeyPair, issueCredential, verifyCredential, type CivicProofCredential } from './vc.js';
import { verifyLedgerReplay, type ReplayVerification } from './replay.js';
import { computeIntegrityIndex, type IntegrityIndex } from './integrityIndex.js';

export interface DemoVerifierResult {
  status: 'normal' | 'duplicate' | 'expired' | 'tampered';
  message: string;
}

export interface DemoScenarioResult {
  stats: RegistryStats;
  events: AuditEvent[];
  credentials: CivicProofCredential[];
  verifierResults: DemoVerifierResult[];
  replayVerification: ReplayVerification;
  integrityIndex: IntegrityIndex;
  publicAuditSummary: string;
}

export async function runDemoScenario(): Promise<DemoScenarioResult> {
  const registry = new InMemoryClaimRegistry();
  const salt = 'demo-agency-secret';
  const issuerKeys = deterministicTestKeyPair('civicproof-demo-issuer');
  const issuerDid = 'did:web:civicproof.example';

  const aliceOssNullifier = createNullifier({
    programId: 'osscontest-2026',
    subjectId: 'alice-private-id',
    salt
  });
  const aliceScholarshipNullifier = createNullifier({
    programId: 'scholarship-2026',
    subjectId: 'alice-private-id',
    salt
  });

  const firstCredential = await issueCredential({
    issuerDid,
    subjectDid: 'did:key:alice-redacted',
    programId: 'osscontest-2026',
    nullifierHash: aliceOssNullifier,
    commitmentHash: '0x' + 'a'.repeat(64),
    expiresAt: '2026-12-31T00:00:00.000Z'
  }, issuerKeys);
  const duplicateCredential = await issueCredential({
    issuerDid,
    subjectDid: 'did:key:alice-redacted',
    programId: 'osscontest-2026',
    nullifierHash: aliceOssNullifier,
    commitmentHash: '0x' + 'b'.repeat(64),
    expiresAt: '2026-12-31T00:00:00.000Z'
  }, issuerKeys);
  const secondProgramCredential = await issueCredential({
    issuerDid,
    subjectDid: 'did:key:alice-redacted',
    programId: 'scholarship-2026',
    nullifierHash: aliceScholarshipNullifier,
    commitmentHash: '0x' + 'c'.repeat(64),
    expiresAt: '2026-12-31T00:00:00.000Z'
  }, issuerKeys);

  const credentials = [firstCredential, duplicateCredential, secondProgramCredential];
  const seenNullifiers = new Set<string>();
  const verifierResults: DemoVerifierResult[] = [];

  for (const credential of credentials) {
    const verification = await verifyCredential(credential, {
      issuerDid,
      publicKeyHex: issuerKeys.publicKeyHex,
      at: new Date('2026-07-01T00:00:00.000Z')
    });
    const duplicateKey = `${credential.credentialSubject.programId}:${credential.credentialSubject.nullifierHash.toLowerCase()}`;
    const status: DemoVerifierResult['status'] = !verification.valid
      ? verification.reason === 'EXPIRED' ? 'expired' : 'tampered'
      : seenNullifiers.has(duplicateKey) ? 'duplicate' : 'normal';

    if (status === 'normal') {
      seenNullifiers.add(duplicateKey);
    }
    verifierResults.push({
      status,
      message: {
        normal: 'Credential signature is valid and no duplicate was found.',
        duplicate: 'Credential signature is valid but the nullifier was already seen for this program.',
        expired: 'Credential signature is valid but the credential is expired.',
        tampered: 'Credential signature or issuer validation failed.'
      }[status]
    });

    registry.registerClaim({
      programId: credential.credentialSubject.programId,
      nullifierHash: credential.credentialSubject.nullifierHash,
      commitmentHash: credential.credentialSubject.commitmentHash,
      metadataUri: credential.id
    });
  }

  const stats = registry.stats();
  const events = registry.auditEvents();
  const replayVerification = verifyLedgerReplay(events, {
    claims: registry.allClaims(),
    stats
  });
  const integrityIndex = computeIntegrityIndex({
    events,
    replayMatch: replayVerification.match,
    credentialChecks: {
      total: verifierResults.length,
      validSignatures: verifierResults.filter((entry) => entry.status !== 'tampered').length
    },
    piiFieldsOnLedger: 0
  });

  return {
    stats,
    events,
    credentials,
    verifierResults,
    replayVerification,
    integrityIndex,
    publicAuditSummary: [
      `Accepted claims: ${stats.totalClaims}`,
      `Duplicate attempts: ${stats.duplicateAttempts}`,
      `Programs represented: ${stats.programs}`,
      'PII stored on-chain: 0 fields',
      `Replay verification: ${replayVerification.match ? 'MATCH' : 'DIVERGED'} (state root ${replayVerification.replayedStateRoot.slice(0, 18)}...)`,
      `Civic Integrity Index: ${integrityIndex.score}/100 ${integrityIndex.grade}`
    ].join('\n')
  };
}

function runCli(): void {
  const program = new Command()
    .name('civicproof-ledger-demo')
    .description('Run the CivicProof Ledger duplicate-benefit demo scenario.')
    .option('--json', 'print the full result as JSON')
    .action(async (options: { json?: boolean }) => {
      const result = await runDemoScenario();
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log('CivicProof Ledger demo');
      console.log(result.publicAuditSummary);
      for (const event of result.events) {
        console.log(`${event.event} ${event.programId} ${event.nullifierHash}`);
      }
    });

  program.parse();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
