import { describe, expect, it } from 'vitest';
import { issueCredential, verifyCredential } from '../src/vc.js';

describe('verifiable credential envelope', () => {
  it('issues and verifies an unsigned-demo VC with required disclosure boundaries', () => {
    const credential = issueCredential({
      issuerDid: 'did:web:issuer.example',
      subjectDid: 'did:key:applicant-redacted',
      programId: 'osscontest-2026',
      nullifierHash: '0x' + '1'.repeat(64),
      commitmentHash: '0x' + '2'.repeat(64),
      expiresAt: '2026-12-31T00:00:00.000Z'
    });

    expect(credential.type).toContain('CivicProofDuplicateBenefitCredential');
    expect(JSON.stringify(credential)).not.toContain('residentRegistrationNumber');
    expect(verifyCredential(credential, new Date('2026-07-01T00:00:00.000Z')).valid).toBe(true);
    expect(verifyCredential(credential, new Date('2027-01-01T00:00:00.000Z'))).toEqual({ valid: false, reason: 'EXPIRED' });
  });
});
