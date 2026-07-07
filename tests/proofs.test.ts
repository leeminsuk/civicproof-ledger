// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';

const proofs = await import('../web/proofs.js');
const {
  buildMembershipProof,
  createSchnorrNullifierProof,
  verifyMembershipProof,
  verifySchnorrNullifierProof
} = proofs;

describe('browser proofs (Schnorr NIZK + Merkle) mirror the Node implementations', () => {
  it('accepts an honest Schnorr nullifier proof', async () => {
    const proof = await createSchnorrNullifierProof({ subjectSecret: 'alice', programId: 'osscontest-2026' });
    expect(await verifySchnorrNullifierProof(proof)).toBe(true);
  });

  it('rejects a Schnorr proof with a mutated response scalar', async () => {
    const proof = await createSchnorrNullifierProof({ subjectSecret: 'alice', programId: 'osscontest-2026' });
    const forged = { ...proof, response: (BigInt(proof.response) + 1n).toString() };
    expect(await verifySchnorrNullifierProof(forged)).toBe(false);
  });

  it('rejects a Schnorr proof replayed into another program', async () => {
    const proof = await createSchnorrNullifierProof({ subjectSecret: 'alice', programId: 'osscontest-2026' });
    const replayed = { ...proof, programId: 'scholarship-2026' };
    expect(await verifySchnorrNullifierProof(replayed)).toBe(false);
  });

  it('accepts an honest Merkle inclusion proof', async () => {
    const leaves = [`0x${'1'.repeat(64)}`, `0x${'2'.repeat(64)}`, `0x${'3'.repeat(64)}`];
    const proof = await buildMembershipProof(leaves, leaves[0]);
    expect(await verifyMembershipProof(proof)).toBe(true);
  });

  it('rejects a Merkle proof with a swapped sibling', async () => {
    const leaves = [`0x${'1'.repeat(64)}`, `0x${'2'.repeat(64)}`, `0x${'3'.repeat(64)}`];
    const proof = await buildMembershipProof(leaves, leaves[0]);
    const forged = { ...proof, siblings: [...proof.siblings] };
    forged.siblings[0] = `0x${'d'.repeat(64)}`;
    expect(await verifyMembershipProof(forged)).toBe(false);
  });
});
