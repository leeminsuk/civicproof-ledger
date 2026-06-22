export interface IssueCredentialInput {
  issuerDid: string;
  subjectDid: string;
  programId: string;
  nullifierHash: string;
  commitmentHash: string;
  expiresAt: string;
}

export interface CivicProofCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate: string;
  credentialSubject: {
    id: string;
    programId: string;
    nullifierHash: string;
    commitmentHash: string;
  };
  proof: {
    type: 'UnsignedDemoProof';
    created: string;
    purpose: 'assertionMethod';
  };
}

export type CredentialVerification =
  | { valid: true }
  | { valid: false; reason: 'EXPIRED' | 'MALFORMED_CREDENTIAL' };

export function issueCredential(input: IssueCredentialInput): CivicProofCredential {
  const issuedAt = new Date().toISOString();

  return {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://civicproof.example/context/v1'
    ],
    id: `urn:civicproof:credential:${input.programId}:${input.nullifierHash.slice(2, 18)}`,
    type: ['VerifiableCredential', 'CivicProofDuplicateBenefitCredential'],
    issuer: input.issuerDid,
    issuanceDate: issuedAt,
    expirationDate: input.expiresAt,
    credentialSubject: {
      id: input.subjectDid,
      programId: input.programId,
      nullifierHash: input.nullifierHash,
      commitmentHash: input.commitmentHash
    },
    proof: {
      type: 'UnsignedDemoProof',
      created: issuedAt,
      purpose: 'assertionMethod'
    }
  };
}

export function verifyCredential(
  credential: CivicProofCredential,
  at: Date = new Date()
): CredentialVerification {
  if (
    !credential.expirationDate ||
    !credential.credentialSubject?.programId ||
    !credential.credentialSubject?.nullifierHash ||
    !credential.credentialSubject?.commitmentHash
  ) {
    return { valid: false, reason: 'MALFORMED_CREDENTIAL' };
  }

  if (new Date(credential.expirationDate).getTime() <= at.getTime()) {
    return { valid: false, reason: 'EXPIRED' };
  }

  return { valid: true };
}
