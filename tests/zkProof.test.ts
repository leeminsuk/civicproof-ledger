import { describe, expect, it } from 'vitest';
import { createSchnorrNullifierProof, verifySchnorrNullifierProof } from '../src/zkProof.js';

describe('Schnorr-style nullifier proof', () => {
  it('proves knowledge of the nullifier secret without revealing the subject id', () => {
    const proof = createSchnorrNullifierProof({
      subjectSecret: 'did:key:applicant-redacted|private-salt',
      programId: 'osscontest-2026',
      nonce: 'fixture-nonce'
    });

    expect(JSON.stringify(proof)).not.toContain('applicant-redacted');
    expect(proof.protocol).toBe('SchnorrNullifierNIZKDemo');
    expect(verifySchnorrNullifierProof(proof)).toBe(true);
  });

  it('rejects tampered program scopes and responses', () => {
    const proof = createSchnorrNullifierProof({
      subjectSecret: 'alice-secret',
      programId: 'grant-2026',
      nonce: 'fixture-nonce'
    });

    expect(verifySchnorrNullifierProof({ ...proof, programId: 'other-program' })).toBe(false);
    expect(verifySchnorrNullifierProof({ ...proof, response: (BigInt(proof.response) + 1n).toString() })).toBe(false);
  });

  it('rejects tampered public keys, commitments, and nullifiers', () => {
    const proof = createSchnorrNullifierProof({
      subjectSecret: 'bob-secret',
      programId: 'voucher-2026',
      nonce: 'fixture-nonce'
    });

    expect(verifySchnorrNullifierProof({ ...proof, publicKey: '1' })).toBe(false);
    expect(verifySchnorrNullifierProof({ ...proof, commitment: '1' })).toBe(false);
    expect(verifySchnorrNullifierProof({ ...proof, nullifier: '0x' + '0'.repeat(64) })).toBe(false);
  });
});
