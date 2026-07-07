// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { buildMembershipProof, verifyMembershipProof } from '../src/nullifierProof.js';

describe('nullifier membership proof', () => {
  it('verifies membership without exposing the original subject identifier', () => {
    const leaves = [
      '0x' + '1'.repeat(64),
      '0x' + '2'.repeat(64),
      '0x' + '3'.repeat(64),
      '0x' + '4'.repeat(64)
    ];

    const proof = buildMembershipProof(leaves, leaves[2]);

    expect(JSON.stringify(proof)).not.toContain('did:key:applicant');
    expect(proof.leaf).toBe(leaves[2]);
    expect(verifyMembershipProof(proof)).toBe(true);
  });

  it('rejects a tampered membership path', () => {
    const leaves = ['0x' + 'a'.repeat(64), '0x' + 'b'.repeat(64)];
    const proof = buildMembershipProof(leaves, leaves[0]);

    proof.siblings[0] = '0x' + 'c'.repeat(64);

    expect(verifyMembershipProof(proof)).toBe(false);
  });

  it('rejects malformed leaves and missing targets', () => {
    expect(() => buildMembershipProof([], '0x' + '1'.repeat(64))).toThrow('at least one leaf');
    expect(() => buildMembershipProof(['not-hex'], 'not-hex')).toThrow('expected 32-byte hex');
    expect(() => buildMembershipProof(['0x' + '1'.repeat(64)], '0x' + '2'.repeat(64))).toThrow('target leaf not found');
  });
});
