import { createHash } from 'node:crypto';

export interface MembershipProof {
  leaf: string;
  root: string;
  index: number;
  siblings: string[];
  leafCount: number;
  note: 'Merkle inclusion proof for audit reproducibility; not a zero-knowledge proof.';
}

export function buildMembershipProof(leaves: string[], targetLeaf: string): MembershipProof {
  validateLeaves(leaves);
  const index = leaves.indexOf(targetLeaf);
  if (index === -1) {
    throw new Error('target leaf not found');
  }

  let level = leaves.map(normalizeHex32);
  let cursor = index;
  const siblings: string[] = [];

  while (level.length > 1) {
    if (level.length % 2 === 1) {
      level.push(level[level.length - 1]);
    }
    const siblingIndex = cursor % 2 === 0 ? cursor + 1 : cursor - 1;
    siblings.push(level[siblingIndex]);

    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(hashPair(level[i], level[i + 1]));
    }
    cursor = Math.floor(cursor / 2);
    level = next;
  }

  return {
    leaf: normalizeHex32(targetLeaf),
    root: level[0],
    index,
    siblings,
    leafCount: leaves.length,
    note: 'Merkle inclusion proof for audit reproducibility; not a zero-knowledge proof.'
  };
}

export function verifyMembershipProof(proof: MembershipProof): boolean {
  try {
    let computed = normalizeHex32(proof.leaf);
    let cursor = proof.index;
    for (const sibling of proof.siblings) {
      const normalizedSibling = normalizeHex32(sibling);
      computed = cursor % 2 === 0 ? hashPair(computed, normalizedSibling) : hashPair(normalizedSibling, computed);
      cursor = Math.floor(cursor / 2);
    }
    return computed === normalizeHex32(proof.root);
  } catch {
    return false;
  }
}

function validateLeaves(leaves: string[]): void {
  if (leaves.length === 0) {
    throw new Error('at least one leaf is required');
  }
  for (const leaf of leaves) {
    normalizeHex32(leaf);
  }
}

function normalizeHex32(value: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('expected 32-byte hex string');
  }
  return value.toLowerCase();
}

function hashPair(left: string, right: string): string {
  return `0x${createHash('sha256')
    .update(Buffer.from(left.slice(2), 'hex'))
    .update(Buffer.from(right.slice(2), 'hex'))
    .digest('hex')}`;
}
