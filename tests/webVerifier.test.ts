import { describe, expect, it } from 'vitest';
import { createNullifier, type AuditEvent } from '../src/ledger.js';
import { deterministicTestKeyPair, issueCredential } from '../src/vc.js';

const webVerifier = await import('../web/verifier.js');
const { buildAuditMetrics, demoScenario, verifyCredentialPaste } = webVerifier;

describe('static web verifier state logic', () => {
  it('classifies a valid pasted credential as normal', async () => {
    const issuerKeys = deterministicTestKeyPair('issuer-a');
    const credential = await issueCredential({
      issuerDid: 'did:web:civicproof.example',
      subjectDid: 'did:key:subject',
      programId: 'osscontest-2026',
      nullifierHash: createNullifier({ programId: 'osscontest-2026', subjectId: 'subject', salt: 's1' }),
      commitmentHash: '0x' + 'a'.repeat(64),
      expiresAt: '2026-12-31T00:00:00.000Z'
    }, issuerKeys);

    const result = await verifyCredentialPaste(JSON.stringify(credential), {
      issuerDid: 'did:web:civicproof.example',
      publicKeyHex: issuerKeys.publicKeyHex,
      seenNullifiers: new Set(),
      at: new Date('2026-07-01T00:00:00.000Z')
    });

    expect(result.status).toBe('normal');
    expect(result.message).toContain('valid');
  });

  it('classifies duplicate pasted credentials by program/nullifier', async () => {
    const issuerKeys = deterministicTestKeyPair('issuer-a');
    const nullifierHash = createNullifier({ programId: 'osscontest-2026', subjectId: 'subject', salt: 's1' });
    const credential = await issueCredential({
      issuerDid: 'did:web:civicproof.example',
      subjectDid: 'did:key:subject',
      programId: 'osscontest-2026',
      nullifierHash,
      commitmentHash: '0x' + 'b'.repeat(64),
      expiresAt: '2026-12-31T00:00:00.000Z'
    }, issuerKeys);

    const result = await verifyCredentialPaste(JSON.stringify(credential), {
      issuerDid: 'did:web:civicproof.example',
      publicKeyHex: issuerKeys.publicKeyHex,
      seenNullifiers: new Set([`osscontest-2026:${nullifierHash}`]),
      at: new Date('2026-07-01T00:00:00.000Z')
    });

    expect(result.status).toBe('duplicate');
  });

  it('classifies expired credentials separately from tampered credentials', async () => {
    const issuerKeys = deterministicTestKeyPair('issuer-a');
    const credential = await issueCredential({
      issuerDid: 'did:web:civicproof.example',
      subjectDid: 'did:key:subject',
      programId: 'osscontest-2026',
      nullifierHash: '0x' + 'c'.repeat(64),
      commitmentHash: '0x' + 'd'.repeat(64),
      expiresAt: '2026-01-01T00:00:00.000Z'
    }, issuerKeys);

    expect((await verifyCredentialPaste(JSON.stringify(credential), {
      issuerDid: 'did:web:civicproof.example',
      publicKeyHex: issuerKeys.publicKeyHex,
      seenNullifiers: new Set(),
      at: new Date('2026-07-01T00:00:00.000Z')
    })).status).toBe('expired');

    credential.expirationDate = '2026-12-31T00:00:00.000Z';
    expect((await verifyCredentialPaste(JSON.stringify(credential), {
      issuerDid: 'did:web:civicproof.example',
      publicKeyHex: issuerKeys.publicKeyHex,
      seenNullifiers: new Set(),
      at: new Date('2026-07-01T00:00:00.000Z')
    })).status).toBe('tampered');
  });

  it('classifies malformed JSON as tampered for the UI flow', async () => {
    const result = await verifyCredentialPaste('{ bad json', {
      issuerDid: 'did:web:civicproof.example',
      publicKeyHex: deterministicTestKeyPair('issuer-a').publicKeyHex,
      seenNullifiers: new Set(),
      at: new Date('2026-07-01T00:00:00.000Z')
    });

    expect(result.status).toBe('tampered');
  });

  it('builds public audit metrics from accepted and duplicate events', () => {
    expect(buildAuditMetrics([
      { event: 'ClaimRegistered', programId: 'a', nullifierHash: '0x' + 'a'.repeat(64), commitmentHash: '0x' + 'b'.repeat(64), metadataUri: 'ipfs://a', accepted: true, timestamp: '2026-01-01T00:00:00.000Z' },
      { event: 'DuplicateDetected', programId: 'a', nullifierHash: '0x' + 'a'.repeat(64), commitmentHash: '0x' + 'c'.repeat(64), metadataUri: 'ipfs://b', accepted: false, reason: 'DUPLICATE_CLAIM', timestamp: '2026-01-01T00:00:01.000Z' }
    ])).toEqual({
      acceptedClaims: 1,
      duplicateAttempts: 1,
      programs: 1,
      piiFieldsStored: 0
    });
  });

  it('exposes a complete static demo scenario for the UI', async () => {
    const scenario = await demoScenario();

    expect(scenario.sampleCredentialJson).toContain('Ed25519Signature2020Demo');
    expect(scenario.metrics).toEqual({ acceptedClaims: 2, duplicateAttempts: 1, programs: 2, piiFieldsStored: 0 });
    expect(scenario.verifierResults.map((result) => result.status)).toEqual(['normal', 'duplicate', 'normal']);
  });
});

describe('static web verifier audit mirrors', () => {
  const { computeIntegrityIndex, replayFromEvents } = webVerifier;

  const healthyEvents: AuditEvent[] = [
    {
      event: 'ClaimRegistered',
      programId: 'osscontest-2026',
      nullifierHash: '0x' + '1'.repeat(64),
      commitmentHash: '0x' + '1'.repeat(64),
      metadataUri: 'urn:1',
      accepted: true,
      timestamp: '2026-07-01T00:00:00.000Z'
    },
    {
      event: 'DuplicateDetected',
      programId: 'osscontest-2026',
      nullifierHash: '0x' + '1'.repeat(64),
      commitmentHash: '0x' + '2'.repeat(64),
      metadataUri: 'urn:2',
      accepted: false,
      reason: 'DUPLICATE_CLAIM',
      timestamp: '2026-07-01T00:00:01.000Z'
    }
  ];

  it('replayFromEvents matches honest claimed metrics', () => {
    const replay = replayFromEvents(healthyEvents, {
      acceptedClaims: 1,
      duplicateAttempts: 1,
      programs: 1,
      piiFieldsStored: 0
    });

    expect(replay.match).toBe(true);
    expect(replay.orderViolations).toEqual([]);
  });

  it('replayFromEvents flags inflated claimed metrics', () => {
    const replay = replayFromEvents(healthyEvents, {
      acceptedClaims: 9,
      duplicateAttempts: 1,
      programs: 1,
      piiFieldsStored: 0
    });

    expect(replay.match).toBe(false);
  });

  it('replayFromEvents flags duplicate events with no prior registration', () => {
    const replay = replayFromEvents([healthyEvents[1]], {
      acceptedClaims: 0,
      duplicateAttempts: 1,
      programs: 0,
      piiFieldsStored: 0
    });

    expect(replay.match).toBe(false);
    expect(replay.orderViolations).toHaveLength(1);
  });

  it('computeIntegrityIndex mirrors the Node cii-v1 score exactly', () => {
    const index = computeIntegrityIndex(healthyEvents, {
      replayMatch: true,
      credentialChecks: { total: 3, validSignatures: 3 },
      piiFieldsOnLedger: 0
    });

    expect(index).toEqual({
      formula: 'cii-v1',
      score: 100,
      grade: 'EXCELLENT',
      subscores: {
        auditConsistency: 40,
        duplicateContainment: 30,
        credentialIntegrity: 20,
        privacyMinimization: 10
      }
    });
  });

  it('computeIntegrityIndex downgrades on replay divergence like the Node version', () => {
    const index = computeIntegrityIndex(healthyEvents, {
      replayMatch: false,
      credentialChecks: { total: 2, validSignatures: 2 },
      piiFieldsOnLedger: 0
    });

    expect(index.score).toBe(60);
    expect(index.grade).toBe('WATCH');
  });
});
