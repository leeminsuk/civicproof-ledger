// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';

// RFC 3526 2048-bit MODP Group prime. This demo is a Schnorr-style
// non-interactive proof of knowledge over a finite-field group. It is included
// to make the privacy proof boundary executable without adding vulnerable ZK
// toolchains. Production should replace it with audited Semaphore/Noir circuits.
const P = BigInt(`0x${[
  'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1',
  '29024E088A67CC74020BBEA63B139B22514A08798E3404DD',
  'EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245',
  'E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED',
  'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D',
  'C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F',
  '83655D23DCA3AD961C62F356208552BB9ED529077096966D',
  '670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B',
  'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9',
  'DE2BCBF6955817183995497CEA956AE515D2261898FA0510',
  '15728E5A8AACAA68FFFFFFFFFFFFFFFF'
].join('')}`);
const Q = (P - 1n) / 2n;
const G = 2n;

export interface SchnorrNullifierProofInput {
  subjectSecret: string;
  programId: string;
  nonce?: string;
}

export interface SchnorrNullifierProof {
  protocol: 'SchnorrNullifierNIZKDemo';
  programId: string;
  publicKey: string;
  nullifier: string;
  commitment: string;
  challenge: string;
  response: string;
  note: 'Demo NIZK proof of secret knowledge; replace with audited Semaphore/Noir circuits for production.';
}

export function createSchnorrNullifierProof(input: SchnorrNullifierProofInput): SchnorrNullifierProof {
  const secret = hashToScalar(`secret:${input.subjectSecret}`);
  const nonce = hashToScalar(`nonce:${input.nonce ?? `${input.programId}:${input.subjectSecret}`}`);
  const publicKey = modPow(G, secret, P);
  const commitment = modPow(G, nonce, P);
  const nullifier = hashHex(`nullifier:${input.programId}:${publicKey.toString()}`);
  const challenge = hashToScalar(`challenge:${input.programId}:${publicKey}:${nullifier}:${commitment}`);
  const response = mod(nonce + challenge * secret, Q);
  return {
    protocol: 'SchnorrNullifierNIZKDemo',
    programId: input.programId,
    publicKey: publicKey.toString(),
    nullifier,
    commitment: commitment.toString(),
    challenge: challenge.toString(),
    response: response.toString(),
    note: 'Demo NIZK proof of secret knowledge; replace with audited Semaphore/Noir circuits for production.'
  };
}

export function verifySchnorrNullifierProof(proof: SchnorrNullifierProof): boolean {
  try {
    if (proof.protocol !== 'SchnorrNullifierNIZKDemo') return false;
    const publicKey = BigInt(proof.publicKey);
    const commitment = BigInt(proof.commitment);
    const challenge = BigInt(proof.challenge);
    const response = BigInt(proof.response);
    if (publicKey <= 1n || publicKey >= P || commitment <= 1n || commitment >= P) return false;
    const expectedNullifier = hashHex(`nullifier:${proof.programId}:${publicKey.toString()}`);
    if (proof.nullifier !== expectedNullifier) return false;
    const expectedChallenge = hashToScalar(`challenge:${proof.programId}:${publicKey}:${proof.nullifier}:${commitment}`);
    if (challenge !== expectedChallenge) return false;
    const left = modPow(G, response, P);
    const right = mod(commitment * modPow(publicKey, challenge, P), P);
    return left === right;
  } catch {
    return false;
  }
}

function hashToScalar(value: string): bigint {
  const scalar = BigInt(`0x${hashHex(value).slice(2)}`) % Q;
  return scalar === 0n ? 1n : scalar;
}

function hashHex(value: string): string {
  return `0x${createHash('sha256').update(value).digest('hex')}`;
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let b = mod(base, modulus);
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = mod(result * b, modulus);
    b = mod(b * b, modulus);
    e >>= 1n;
  }
  return result;
}

function mod(value: bigint, modulus: bigint): bigint {
  const result = value % modulus;
  return result >= 0n ? result : result + modulus;
}
