export interface SchnorrNullifierProof {
  protocol: 'SchnorrNullifierNIZKDemo';
  programId: string;
  publicKey: string;
  nullifier: string;
  commitment: string;
  challenge: string;
  response: string;
}

export interface MembershipProof {
  leaf: string;
  root: string;
  index: number;
  siblings: string[];
  leafCount: number;
}

export function createSchnorrNullifierProof(input: {
  subjectSecret: string;
  programId: string;
  nonce?: string;
}): Promise<SchnorrNullifierProof>;
export function verifySchnorrNullifierProof(proof: SchnorrNullifierProof): Promise<boolean>;
export function buildMembershipProof(leaves: string[], targetLeaf: string): Promise<MembershipProof>;
export function verifyMembershipProof(proof: MembershipProof): Promise<boolean>;
