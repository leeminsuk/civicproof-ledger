import { createHash } from 'node:crypto';
import * as ed25519 from '@noble/ed25519';

ed25519.etc.sha512Sync = (...messages: Uint8Array[]): Uint8Array =>
  createHash('sha512')
    .update(Buffer.concat(messages.map((message) => Buffer.from(message))))
    .digest();

export interface IssueCredentialInput {
  issuerDid: string;
  subjectDid: string;
  programId: string;
  nullifierHash: string;
  commitmentHash: string;
  expiresAt: string;
}

export interface IssuerKeyPair {
  privateKeyHex: string;
  publicKeyHex: string;
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
    type: 'Ed25519Signature2020Demo';
    created: string;
    purpose: 'assertionMethod';
    verificationMethod: string;
    proofValue: string;
  };
}

export type CredentialVerification =
  | { valid: true }
  | { valid: false; reason: 'EXPIRED' | 'MALFORMED_CREDENTIAL' | 'TAMPERED' | 'WRONG_ISSUER' };

export interface VerifyCredentialOptions {
  issuerDid: string;
  publicKeyHex: string;
  at?: Date;
}

export function generateIssuerKeyPair(): IssuerKeyPair {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return {
    privateKeyHex: bytesToHex(privateKey),
    publicKeyHex: bytesToHex(publicKey)
  };
}

export function deterministicTestKeyPair(label: string): IssuerKeyPair {
  const privateKey = createHash('sha256')
    .update('civicproof:test-ed25519:v1')
    .update('\0')
    .update(label)
    .digest();
  const publicKey = ed25519.getPublicKey(privateKey);
  return {
    privateKeyHex: bytesToHex(privateKey),
    publicKeyHex: bytesToHex(publicKey)
  };
}

export async function issueCredential(input: IssueCredentialInput, issuerKeys: IssuerKeyPair): Promise<CivicProofCredential> {
  const issuedAt = new Date().toISOString();

  const credential: CivicProofCredential = {
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
      type: 'Ed25519Signature2020Demo',
      created: issuedAt,
      purpose: 'assertionMethod',
      verificationMethod: `${input.issuerDid}#ed25519-demo`,
      proofValue: ''
    }
  };

  const message = new TextEncoder().encode(canonicalizeCredentialForSigning(unsignedCredential(credential)));
  const signature = await ed25519.signAsync(message, hexToBytes(issuerKeys.privateKeyHex));
  credential.proof.proofValue = bytesToHex(signature);
  return credential;
}

export async function verifyCredential(
  credential: CivicProofCredential,
  options: VerifyCredentialOptions
): Promise<CredentialVerification> {
  if (
    !credential ||
    credential.issuer !== options.issuerDid ||
    !credential.expirationDate ||
    !credential.proof ||
    credential.proof.type !== 'Ed25519Signature2020Demo' ||
    !isHex(credential.proof.proofValue, 128) ||
    !isHex(options.publicKeyHex, 64) ||
    !credential.credentialSubject?.programId ||
    !credential.credentialSubject?.nullifierHash ||
    !credential.credentialSubject?.commitmentHash
  ) {
    if (credential?.issuer && credential.issuer !== options.issuerDid) {
      return { valid: false, reason: 'WRONG_ISSUER' };
    }
    return { valid: false, reason: 'MALFORMED_CREDENTIAL' };
  }

  const expirationTime = new Date(credential.expirationDate).getTime();
  if (!Number.isFinite(expirationTime)) {
    return { valid: false, reason: 'MALFORMED_CREDENTIAL' };
  }

  if (expirationTime <= (options.at ?? new Date()).getTime()) {
    return { valid: false, reason: 'EXPIRED' };
  }

  const verified = await ed25519.verifyAsync(
    hexToBytes(credential.proof.proofValue),
    new TextEncoder().encode(canonicalizeCredentialForSigning(unsignedCredential(credential))),
    hexToBytes(options.publicKeyHex)
  );
  if (!verified) {
    return { valid: false, reason: 'TAMPERED' };
  }

  return { valid: true };
}

export function canonicalizeCredentialForSigning(value: unknown): string {
  return JSON.stringify(sortForCanonicalJson(value));
}

function unsignedCredential(credential: CivicProofCredential): unknown {
  return {
    ...credential,
    proof: {
      ...credential.proof,
      proofValue: undefined
    }
  };
}

function sortForCanonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortForCanonicalJson(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortForCanonicalJson(entry)])
    );
  }

  return value;
}

function isHex(value: string, hexLength: number): boolean {
  return new RegExp(`^[0-9a-fA-F]{${hexLength}}$`).test(value);
}

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}
