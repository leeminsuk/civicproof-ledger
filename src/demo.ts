import { Command } from 'commander';
import { createNullifier, InMemoryClaimRegistry, type AuditEvent, type RegistryStats } from './ledger.js';
import { issueCredential } from './vc.js';

export interface DemoScenarioResult {
  stats: RegistryStats;
  events: AuditEvent[];
  publicAuditSummary: string;
}

export function runDemoScenario(): DemoScenarioResult {
  const registry = new InMemoryClaimRegistry();
  const salt = 'demo-agency-secret';

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

  const firstCredential = issueCredential({
    issuerDid: 'did:web:civicproof.example',
    subjectDid: 'did:key:alice-redacted',
    programId: 'osscontest-2026',
    nullifierHash: aliceOssNullifier,
    commitmentHash: '0x' + 'a'.repeat(64),
    expiresAt: '2026-12-31T00:00:00.000Z'
  });
  const duplicateCredential = issueCredential({
    issuerDid: 'did:web:civicproof.example',
    subjectDid: 'did:key:alice-redacted',
    programId: 'osscontest-2026',
    nullifierHash: aliceOssNullifier,
    commitmentHash: '0x' + 'b'.repeat(64),
    expiresAt: '2026-12-31T00:00:00.000Z'
  });
  const secondProgramCredential = issueCredential({
    issuerDid: 'did:web:civicproof.example',
    subjectDid: 'did:key:alice-redacted',
    programId: 'scholarship-2026',
    nullifierHash: aliceScholarshipNullifier,
    commitmentHash: '0x' + 'c'.repeat(64),
    expiresAt: '2026-12-31T00:00:00.000Z'
  });

  for (const credential of [firstCredential, duplicateCredential, secondProgramCredential]) {
    registry.registerClaim({
      programId: credential.credentialSubject.programId,
      nullifierHash: credential.credentialSubject.nullifierHash,
      commitmentHash: credential.credentialSubject.commitmentHash,
      metadataUri: credential.id
    });
  }

  const stats = registry.stats();

  return {
    stats,
    events: registry.auditEvents(),
    publicAuditSummary: [
      `Accepted claims: ${stats.totalClaims}`,
      `Duplicate attempts: ${stats.duplicateAttempts}`,
      `Programs represented: ${stats.programs}`,
      'PII stored on-chain: 0 fields'
    ].join('\n')
  };
}

function runCli(): void {
  const program = new Command()
    .name('civicproof-ledger-demo')
    .description('Run the CivicProof Ledger duplicate-benefit demo scenario.')
    .option('--json', 'print the full result as JSON')
    .action((options: { json?: boolean }) => {
      const result = runDemoScenario();
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
