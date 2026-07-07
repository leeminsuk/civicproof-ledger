// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  canonicalizeCredentialForSigning,
  deterministicTestKeyPair,
  generateIssuerKeyPair,
  issueCredential,
  verifyCredential
} from '../src/vc.js';

describe('verifiable credential envelope', () => {
  it('issues and verifies an Ed25519-signed demo VC with required disclosure boundaries', async () => {
    const issuerKeys = deterministicTestKeyPair('issuer-a');
    const credential = await issueCredential({
      issuerDid: 'did:web:issuer.example',
      subjectDid: 'did:key:applicant-redacted',
      programId: 'osscontest-2026',
      nullifierHash: '0x' + '1'.repeat(64),
      commitmentHash: '0x' + '2'.repeat(64),
      expiresAt: '2026-12-31T00:00:00.000Z'
    }, issuerKeys);

    expect(credential.type).toContain('CivicProofDuplicateBenefitCredential');
    expect(credential.proof.type).toBe('Ed25519Signature2020Demo');
    expect(JSON.stringify(credential)).not.toContain('UnsignedDemoProof');
    expect(JSON.stringify(credential)).not.toContain('residentRegistrationNumber');
    expect(await verifyCredential(credential, {
      issuerDid: 'did:web:issuer.example',
      publicKeyHex: issuerKeys.publicKeyHex,
      at: new Date('2026-07-01T00:00:00.000Z')
    })).toEqual({ valid: true });
    expect(await verifyCredential(credential, {
      issuerDid: 'did:web:issuer.example',
      publicKeyHex: issuerKeys.publicKeyHex,
      at: new Date('2027-01-01T00:00:00.000Z')
    })).toEqual({ valid: false, reason: 'EXPIRED' });
  });

  it('generates usable random issuer key pairs', async () => {
    const issuerKeys = generateIssuerKeyPair();
    const credential = await issueCredential({
      issuerDid: 'did:web:issuer.example',
      subjectDid: 'did:key:subject',
      programId: 'grant-2026',
      nullifierHash: '0x' + '3'.repeat(64),
      commitmentHash: '0x' + '4'.repeat(64),
      expiresAt: '2026-12-31T00:00:00.000Z'
    }, issuerKeys);

    expect(issuerKeys.privateKeyHex).toMatch(/^[0-9a-f]{64}$/);
    expect(issuerKeys.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyCredential(credential, {
      issuerDid: 'did:web:issuer.example',
      publicKeyHex: issuerKeys.publicKeyHex,
      at: new Date('2026-07-01T00:00:00.000Z')
    })).toEqual({ valid: true });
  });

  it('canonicalizes object keys deterministically before signing with RFC 8785-compatible JCS', async () => {
    expect(canonicalizeCredentialForSigning({ b: 2, a: { d: 4, c: 3 }, skip: undefined })).toBe('{"a":{"c":3,"d":4},"b":2}');
    expect(canonicalizeCredentialForSigning({ text: '한글', arr: [{ z: 1, a: 2 }] })).toBe('{"arr":[{"a":2,"z":1}],"text":"한글"}');
  });

  it('detects tampering after issuance', async () => {
    const issuerKeys = deterministicTestKeyPair('issuer-a');
    const credential = await issueCredential({
      issuerDid: 'did:web:issuer.example',
      subjectDid: 'did:key:subject',
      programId: 'grant-2026',
      nullifierHash: '0x' + '5'.repeat(64),
      commitmentHash: '0x' + '6'.repeat(64),
      expiresAt: '2026-12-31T00:00:00.000Z'
    }, issuerKeys);

    credential.credentialSubject.commitmentHash = '0x' + '7'.repeat(64);

    expect(await verifyCredential(credential, {
      issuerDid: 'did:web:issuer.example',
      publicKeyHex: issuerKeys.publicKeyHex,
      at: new Date('2026-07-01T00:00:00.000Z')
    })).toEqual({ valid: false, reason: 'TAMPERED' });
  });

  it('rejects credentials presented for the wrong issuer', async () => {
    const issuerKeys = deterministicTestKeyPair('issuer-a');
    const credential = await issueCredential({
      issuerDid: 'did:web:issuer.example',
      subjectDid: 'did:key:subject',
      programId: 'grant-2026',
      nullifierHash: '0x' + '8'.repeat(64),
      commitmentHash: '0x' + '9'.repeat(64),
      expiresAt: '2026-12-31T00:00:00.000Z'
    }, issuerKeys);

    expect(await verifyCredential(credential, {
      issuerDid: 'did:web:other.example',
      publicKeyHex: issuerKeys.publicKeyHex,
      at: new Date('2026-07-01T00:00:00.000Z')
    })).toEqual({ valid: false, reason: 'WRONG_ISSUER' });
  });

  it('rejects credentials with malformed proof material', async () => {
    const credential = await issueCredential({
      issuerDid: 'did:web:issuer.example',
      subjectDid: 'did:key:subject',
      programId: 'grant-2026',
      nullifierHash: '0x' + 'a'.repeat(64),
      commitmentHash: '0x' + 'b'.repeat(64),
      expiresAt: '2026-12-31T00:00:00.000Z'
    }, deterministicTestKeyPair('issuer-a'));

    credential.proof.proofValue = 'not-hex';

    expect(await verifyCredential(credential, {
      issuerDid: 'did:web:issuer.example',
      publicKeyHex: deterministicTestKeyPair('issuer-a').publicKeyHex,
      at: new Date('2026-07-01T00:00:00.000Z')
    })).toEqual({ valid: false, reason: 'MALFORMED_CREDENTIAL' });
  });
});
