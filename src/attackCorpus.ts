import { Command } from 'commander';
import { createNullifier, InMemoryClaimRegistry } from './ledger.js';
import { deterministicTestKeyPair, issueCredential, verifyCredential } from './vc.js';
import { buildMembershipProof, verifyMembershipProof } from './nullifierProof.js';
import { createSchnorrNullifierProof, verifySchnorrNullifierProof } from './zkProof.js';
import { verifyLedgerReplay } from './replay.js';
import type { AuditEvent } from './ledger.js';

export interface AttackResult {
  id: string;
  name: string;
  category: 'credential' | 'ledger' | 'proof' | 'audit-log' | 'privacy';
  blocked: boolean;
  expectedDefense: string;
  observed: string;
}

export interface AttackCorpusReport {
  protocol: 'civicproof-redteam-v1';
  total: number;
  blocked: number;
  leaked: number;
  allBlocked: boolean;
  results: AttackResult[];
}

const ISSUER_DID = 'did:web:civicproof.example';
const OTHER_ISSUER_DID = 'did:web:attacker.example';
const EXPIRES = '2026-12-31T00:00:00.000Z';
const VERIFY_AT = new Date('2026-07-01T00:00:00.000Z');

/**
 * Red-Team Attack Corpus: every judge question of the form "what if an
 * attacker does X?" is encoded as an executable scenario. The corpus fails
 * (non-zero exit) unless 100% of attacks are blocked, and it runs in CI, so
 * a regression that weakens any defense breaks the build.
 */
export async function runAttackCorpus(): Promise<AttackCorpusReport> {
  const issuerKeys = deterministicTestKeyPair('civicproof-demo-issuer');
  const attackerKeys = deterministicTestKeyPair('civicproof-attacker');
  const nullifierHash = createNullifier({
    programId: 'osscontest-2026',
    subjectId: 'alice-private-id',
    salt: 'agency-secret'
  });
  const baseCredential = await issueCredential(
    {
      issuerDid: ISSUER_DID,
      subjectDid: 'did:key:alice-redacted',
      programId: 'osscontest-2026',
      nullifierHash,
      commitmentHash: `0x${'a'.repeat(64)}`,
      expiresAt: EXPIRES
    },
    issuerKeys
  );
  const verifyOptions = { issuerDid: ISSUER_DID, publicKeyHex: issuerKeys.publicKeyHex, at: VERIFY_AT };

  const results: AttackResult[] = [];

  {
    const tampered = structuredClone(baseCredential);
    tampered.credentialSubject.commitmentHash = `0x${'f'.repeat(64)}`;
    const verification = await verifyCredential(tampered, verifyOptions);
    results.push({
      id: 'ATK-01',
      name: 'Credential field tamper (commitment swap after signing)',
      category: 'credential',
      blocked: !verification.valid && verification.reason === 'TAMPERED',
      expectedDefense: 'Canonical-JSON Ed25519 signature covers every credential field',
      observed: verification.valid ? 'accepted' : `rejected:${verification.reason}`
    });
  }

  {
    const stripped = structuredClone(baseCredential);
    stripped.proof.proofValue = '';
    const verification = await verifyCredential(stripped, verifyOptions);
    results.push({
      id: 'ATK-02',
      name: 'Signature stripping (empty proofValue)',
      category: 'credential',
      blocked: !verification.valid && verification.reason === 'MALFORMED_CREDENTIAL',
      expectedDefense: 'Proof shape validation requires a 64-byte hex signature',
      observed: verification.valid ? 'accepted' : `rejected:${verification.reason}`
    });
  }

  {
    const forged = await issueCredential(
      {
        issuerDid: ISSUER_DID,
        subjectDid: 'did:key:alice-redacted',
        programId: 'osscontest-2026',
        nullifierHash,
        commitmentHash: `0x${'a'.repeat(64)}`,
        expiresAt: EXPIRES
      },
      attackerKeys
    );
    const verification = await verifyCredential(forged, verifyOptions);
    results.push({
      id: 'ATK-03',
      name: 'Issuer key forgery (attacker signs with own key, claims real DID)',
      category: 'credential',
      blocked: !verification.valid && verification.reason === 'TAMPERED',
      expectedDefense: 'Signature must verify against the registered issuer public key',
      observed: verification.valid ? 'accepted' : `rejected:${verification.reason}`
    });
  }

  {
    const impostor = structuredClone(baseCredential);
    impostor.issuer = OTHER_ISSUER_DID;
    const verification = await verifyCredential(impostor, verifyOptions);
    results.push({
      id: 'ATK-04',
      name: 'Wrong issuer DID substitution',
      category: 'credential',
      blocked: !verification.valid && verification.reason === 'WRONG_ISSUER',
      expectedDefense: 'Issuer DID allowlist check before signature verification',
      observed: verification.valid ? 'accepted' : `rejected:${verification.reason}`
    });
  }

  {
    const expired = await issueCredential(
      {
        issuerDid: ISSUER_DID,
        subjectDid: 'did:key:alice-redacted',
        programId: 'osscontest-2026',
        nullifierHash,
        commitmentHash: `0x${'a'.repeat(64)}`,
        expiresAt: '2025-01-01T00:00:00.000Z'
      },
      issuerKeys
    );
    const verification = await verifyCredential(expired, verifyOptions);
    results.push({
      id: 'ATK-05',
      name: 'Expired credential replay',
      category: 'credential',
      blocked: !verification.valid && verification.reason === 'EXPIRED',
      expectedDefense: 'Expiration timestamp checked at verification time',
      observed: verification.valid ? 'accepted' : `rejected:${verification.reason}`
    });
  }

  {
    const registry = new InMemoryClaimRegistry();
    registry.registerClaim({
      programId: 'osscontest-2026',
      nullifierHash,
      commitmentHash: `0x${'a'.repeat(64)}`,
      metadataUri: baseCredential.id
    });
    const replayResult = registry.registerClaim({
      programId: 'osscontest-2026',
      nullifierHash,
      commitmentHash: `0x${'b'.repeat(64)}`,
      metadataUri: baseCredential.id
    });
    const original = registry.getClaim('osscontest-2026', nullifierHash);
    results.push({
      id: 'ATK-06',
      name: 'Same-program nullifier replay (duplicate benefit attempt)',
      category: 'ledger',
      blocked:
        !replayResult.accepted &&
        replayResult.reason === 'DUPLICATE_CLAIM' &&
        original?.commitmentHash === `0x${'a'.repeat(64)}`,
      expectedDefense: 'Program-scoped nullifier uniqueness; original claim never overwritten',
      observed: replayResult.accepted ? 'accepted' : `rejected:${replayResult.reason}`
    });
  }

  {
    const scholarshipNullifier = createNullifier({
      programId: 'scholarship-2026',
      subjectId: 'alice-private-id',
      salt: 'agency-secret'
    });
    results.push({
      id: 'ATK-07',
      name: 'Cross-program linkage (correlate one citizen across programs)',
      category: 'privacy',
      blocked: scholarshipNullifier !== nullifierHash,
      expectedDefense: 'Program ID is part of the nullifier preimage, so identifiers never repeat across programs',
      observed:
        scholarshipNullifier === nullifierHash ? 'identical nullifier leaked linkage' : 'nullifiers differ per program'
    });
  }

  {
    const registry = new InMemoryClaimRegistry();
    let blocked = false;
    let observed = 'accepted';
    try {
      registry.registerClaim({
        programId: 'osscontest-2026',
        nullifierHash: '0x1234',
        commitmentHash: `0x${'a'.repeat(64)}`,
        metadataUri: 'ipfs://x'
      });
    } catch (error) {
      blocked = true;
      observed = `rejected:${error instanceof Error ? error.message : String(error)}`;
    }
    results.push({
      id: 'ATK-08',
      name: 'Malformed nullifier injection (short hash)',
      category: 'ledger',
      blocked,
      expectedDefense: 'Strict 32-byte hex validation on every registry input',
      observed
    });
  }

  {
    const proof = createSchnorrNullifierProof({ subjectSecret: 'alice-secret', programId: 'osscontest-2026' });
    const forged = { ...proof, response: (BigInt(proof.response) + 1n).toString() };
    results.push({
      id: 'ATK-09',
      name: 'Schnorr proof forgery (mutated response scalar)',
      category: 'proof',
      blocked: !verifySchnorrNullifierProof(forged) && verifySchnorrNullifierProof(proof),
      expectedDefense: 'Fiat-Shamir challenge binds response to commitment, key, and nullifier',
      observed: verifySchnorrNullifierProof(forged) ? 'forged proof accepted' : 'forged proof rejected'
    });
  }

  {
    const proof = createSchnorrNullifierProof({ subjectSecret: 'alice-secret', programId: 'osscontest-2026' });
    const stolen = { ...proof, programId: 'scholarship-2026' };
    results.push({
      id: 'ATK-10',
      name: 'Schnorr proof cross-program replay (reuse proof in another program)',
      category: 'proof',
      blocked: !verifySchnorrNullifierProof(stolen),
      expectedDefense: 'Program ID is bound into both the nullifier and the challenge hash',
      observed: verifySchnorrNullifierProof(stolen) ? 'replayed proof accepted' : 'replayed proof rejected'
    });
  }

  {
    const leaves = [nullifierHash, `0x${'1'.repeat(64)}`, `0x${'2'.repeat(64)}`];
    const proof = buildMembershipProof(leaves, nullifierHash);
    const forged = { ...proof, siblings: [...proof.siblings] };
    forged.siblings[0] = `0x${'d'.repeat(64)}`;
    results.push({
      id: 'ATK-11',
      name: 'Merkle membership forgery (swapped sibling path)',
      category: 'proof',
      blocked: !verifyMembershipProof(forged) && verifyMembershipProof(proof),
      expectedDefense: 'Recomputed root must equal the published audit root',
      observed: verifyMembershipProof(forged) ? 'forged path accepted' : 'forged path rejected'
    });
  }

  {
    const registry = new InMemoryClaimRegistry();
    registry.registerClaim({
      programId: 'osscontest-2026',
      nullifierHash,
      commitmentHash: `0x${'a'.repeat(64)}`,
      metadataUri: baseCredential.id
    });
    const forgedEvents: AuditEvent[] = [
      ...registry.auditEvents(),
      {
        event: 'DuplicateDetected',
        programId: 'scholarship-2026',
        nullifierHash: `0x${'9'.repeat(64)}`,
        commitmentHash: `0x${'9'.repeat(64)}`,
        metadataUri: 'ipfs://forged',
        accepted: false,
        reason: 'DUPLICATE_CLAIM',
        timestamp: new Date().toISOString()
      }
    ];
    const verification = verifyLedgerReplay(forgedEvents, {
      claims: registry.allClaims(),
      stats: registry.stats()
    });
    results.push({
      id: 'ATK-12',
      name: 'Audit-log forgery (injected duplicate event with no registered claim)',
      category: 'audit-log',
      blocked:
        !verification.match &&
        verification.divergences.some((divergence) => divergence.code === 'EVENT_ORDER_VIOLATION'),
      expectedDefense: 'Replay-Verify Engine re-derives full state from events and flags order violations',
      observed: verification.match ? 'forged log matched state' : verification.divergences.map((d) => d.code).join(',')
    });
  }

  const blocked = results.filter((result) => result.blocked).length;
  return {
    protocol: 'civicproof-redteam-v1',
    total: results.length,
    blocked,
    leaked: results.length - blocked,
    allBlocked: blocked === results.length,
    results
  };
}

function runCli(): void {
  const program = new Command()
    .name('civicproof-redteam')
    .description('Run the CivicProof adversarial attack corpus. Exits non-zero unless 100% of attacks are blocked.')
    .option('--json', 'print the full report as JSON')
    .action(async (options: { json?: boolean }) => {
      const report = await runAttackCorpus();
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(`CivicProof Red-Team Attack Corpus (${report.protocol})`);
        for (const result of report.results) {
          console.log(`${result.blocked ? 'BLOCKED' : 'LEAKED '} ${result.id} [${result.category}] ${result.name}`);
        }
        console.log(`Blocked ${report.blocked}/${report.total} attacks`);
      }
      if (!report.allBlocked) {
        process.exitCode = 1;
      }
    });

  program.parse();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
