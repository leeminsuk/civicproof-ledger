// Browser mirrors of src/zkProof.ts (Schnorr NIZK demo) and src/nullifierProof.ts
// (Merkle inclusion proof). Pure BigInt / WebCrypto — no Node dependencies — so
// the attack theater can run the proof-layer scenarios fully client-side.

const encoder = new TextEncoder();

// RFC 3526 2048-bit MODP prime, same group as src/zkProof.ts.
const P = BigInt(
  '0x' +
    [
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
    ].join('')
);
const Q = (P - 1n) / 2n;
const G = 2n;

async function sha256Raw(value) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(value));
  return `0x${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

async function hashToScalar(value) {
  const scalar = BigInt(await sha256Raw(value)) % Q;
  return scalar === 0n ? 1n : scalar;
}

function modPow(base, exponent, modulus) {
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

function mod(value, modulus) {
  const r = value % modulus;
  return r >= 0n ? r : r + modulus;
}

export async function createSchnorrNullifierProof({ subjectSecret, programId, nonce }) {
  const secret = await hashToScalar(`secret:${subjectSecret}`);
  const nonceScalar = await hashToScalar(`nonce:${nonce ?? `${programId}:${subjectSecret}`}`);
  const publicKey = modPow(G, secret, P);
  const commitment = modPow(G, nonceScalar, P);
  const nullifier = await sha256Raw(`nullifier:${programId}:${publicKey.toString()}`);
  const challenge = await hashToScalar(`challenge:${programId}:${publicKey}:${nullifier}:${commitment}`);
  const response = mod(nonceScalar + challenge * secret, Q);
  return {
    protocol: 'SchnorrNullifierNIZKDemo',
    programId,
    publicKey: publicKey.toString(),
    nullifier,
    commitment: commitment.toString(),
    challenge: challenge.toString(),
    response: response.toString()
  };
}

export async function verifySchnorrNullifierProof(proof) {
  try {
    if (proof.protocol !== 'SchnorrNullifierNIZKDemo') return false;
    const publicKey = BigInt(proof.publicKey);
    const commitment = BigInt(proof.commitment);
    const challenge = BigInt(proof.challenge);
    const response = BigInt(proof.response);
    if (publicKey <= 1n || publicKey >= P || commitment <= 1n || commitment >= P) return false;
    const expectedNullifier = await sha256Raw(`nullifier:${proof.programId}:${publicKey.toString()}`);
    if (proof.nullifier !== expectedNullifier) return false;
    const expectedChallenge = await hashToScalar(
      `challenge:${proof.programId}:${publicKey}:${proof.nullifier}:${commitment}`
    );
    if (challenge !== expectedChallenge) return false;
    const left = modPow(G, response, P);
    const right = mod(commitment * modPow(publicKey, challenge, P), P);
    return left === right;
  } catch {
    return false;
  }
}

function normalizeHex32(value) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('expected 32-byte hex string');
  }
  return value.toLowerCase();
}

async function hashPair(left, right) {
  const bytes = new Uint8Array(64);
  bytes.set(hexToBytes(left.slice(2)), 0);
  bytes.set(hexToBytes(right.slice(2)), 32);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `0x${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

function hexToBytes(hex) {
  return Uint8Array.from(hex.match(/.{1,2}/g).map((b) => Number.parseInt(b, 16)));
}

export async function buildMembershipProof(leaves, targetLeaf) {
  const index = leaves.indexOf(targetLeaf);
  if (index === -1) throw new Error('target leaf not found');

  let level = leaves.map(normalizeHex32);
  let cursor = index;
  const siblings = [];

  while (level.length > 1) {
    if (level.length % 2 === 1) level.push(level[level.length - 1]);
    const siblingIndex = cursor % 2 === 0 ? cursor + 1 : cursor - 1;
    siblings.push(level[siblingIndex]);
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(await hashPair(level[i], level[i + 1]));
    }
    cursor = Math.floor(cursor / 2);
    level = next;
  }

  return { leaf: normalizeHex32(targetLeaf), root: level[0], index, siblings, leafCount: leaves.length };
}

export async function verifyMembershipProof(proof) {
  try {
    let computed = normalizeHex32(proof.leaf);
    let cursor = proof.index;
    for (const sibling of proof.siblings) {
      const normalized = normalizeHex32(sibling);
      computed = cursor % 2 === 0 ? await hashPair(computed, normalized) : await hashPair(normalized, computed);
      cursor = Math.floor(cursor / 2);
    }
    return computed === normalizeHex32(proof.root);
  } catch {
    return false;
  }
}
