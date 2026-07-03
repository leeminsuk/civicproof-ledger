import * as ed25519 from '@noble/ed25519';

const encoder = new TextEncoder();

export const demoIssuer = {
  did: 'did:web:civicproof.example',
  privateKeyHex: '1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100',
  publicKeyHex: '712651f450ba05b63898b99ef5f7ba45632e8e2527f7f715cd671ec4024cc51e'
};

export async function verifyCredentialPaste(jsonText, options) {
  let credential;
  try {
    credential = JSON.parse(jsonText);
  } catch {
    return { status: 'tampered', message: 'The pasted JSON is malformed.' };
  }

  const verification = await verifySignedCredential(credential, options);
  if (!verification.valid) {
    const status = verification.reason === 'EXPIRED' ? 'expired' : 'tampered';
    return { status, message: resultMessage(status), reason: verification.reason };
  }

  const subject = credential.credentialSubject;
  const duplicateKey = `${subject.programId}:${subject.nullifierHash.toLowerCase()}`;
  if (options.seenNullifiers.has(duplicateKey)) {
    return { status: 'duplicate', message: resultMessage('duplicate'), duplicateKey };
  }

  options.seenNullifiers.add(duplicateKey);
  return { status: 'normal', message: resultMessage('normal'), duplicateKey };
}

export function buildAuditMetrics(events) {
  return {
    acceptedClaims: events.filter((event) => event.accepted).length,
    duplicateAttempts: events.filter((event) => !event.accepted).length,
    programs: new Set(events.filter((event) => event.accepted).map((event) => event.programId)).size,
    piiFieldsStored: 0
  };
}

// Browser mirror of src/replay.ts: re-derive audit metrics purely from the
// event log and compare them with the metrics the ledger claims to have.
export function replayFromEvents(events, claimedMetrics) {
  const derived = buildAuditMetrics(events);
  const seen = new Set();
  const orderViolations = [];
  for (const event of events) {
    const key = `${event.programId}:${event.nullifierHash.toLowerCase()}`;
    if (event.accepted) {
      seen.add(key);
    } else if (!seen.has(key)) {
      orderViolations.push(key);
    }
  }
  const match =
    orderViolations.length === 0 &&
    derived.acceptedClaims === claimedMetrics.acceptedClaims &&
    derived.duplicateAttempts === claimedMetrics.duplicateAttempts &&
    derived.programs === claimedMetrics.programs;
  return { match, derived, orderViolations };
}

// Browser mirror of src/integrityIndex.ts (cii-v1): deterministic weights,
// no randomness, identical grades to the Node implementation.
export function computeIntegrityIndex(events, options) {
  const duplicates = events.filter((event) => !event.accepted);
  const blockedDuplicates = duplicates.filter((event) => event.reason === 'DUPLICATE_CLAIM');
  const auditConsistency = options.replayMatch ? 40 : 0;
  const duplicateContainment =
    duplicates.length === 0 ? 30 : Math.round(30 * (blockedDuplicates.length / duplicates.length));
  const credentialIntegrity =
    options.credentialChecks.total === 0
      ? 20
      : Math.round(20 * (options.credentialChecks.validSignatures / options.credentialChecks.total));
  const privacyMinimization = options.piiFieldsOnLedger === 0 ? 10 : 0;
  const score = auditConsistency + duplicateContainment + credentialIntegrity + privacyMinimization;
  return {
    formula: 'cii-v1',
    score,
    grade: score >= 90 ? 'EXCELLENT' : score >= 75 ? 'GOOD' : score >= 50 ? 'WATCH' : 'ALERT',
    subscores: { auditConsistency, duplicateContainment, credentialIntegrity, privacyMinimization }
  };
}

export async function demoScenario() {
  const first = await issueDemoCredential({
    subjectDid: 'did:key:alice-redacted',
    programId: 'osscontest-2026',
    nullifierHash: await sha256Hex('osscontest-2026:alice:salt'),
    commitmentHash: `0x${'a'.repeat(64)}`,
    expiresAt: '2026-12-31T00:00:00.000Z'
  });
  const duplicate = await issueDemoCredential({
    subjectDid: 'did:key:alice-redacted',
    programId: 'osscontest-2026',
    nullifierHash: first.credentialSubject.nullifierHash,
    commitmentHash: `0x${'b'.repeat(64)}`,
    expiresAt: '2026-12-31T00:00:00.000Z'
  });
  const secondProgram = await issueDemoCredential({
    subjectDid: 'did:key:alice-redacted',
    programId: 'scholarship-2026',
    nullifierHash: await sha256Hex('scholarship-2026:alice:salt'),
    commitmentHash: `0x${'c'.repeat(64)}`,
    expiresAt: '2026-12-31T00:00:00.000Z'
  });

  const seenNullifiers = new Set();
  const verifierOptions = {
    issuerDid: demoIssuer.did,
    publicKeyHex: demoIssuer.publicKeyHex,
    seenNullifiers,
    at: new Date('2026-07-01T00:00:00.000Z')
  };
  const credentials = [first, duplicate, secondProgram];
  const verifierResults = [];
  const events = [];

  for (const credential of credentials) {
    const result = await verifyCredentialPaste(JSON.stringify(credential), verifierOptions);
    verifierResults.push(result);
    events.push({
      event: result.status === 'duplicate' ? 'DuplicateDetected' : 'ClaimRegistered',
      programId: credential.credentialSubject.programId,
      nullifierHash: credential.credentialSubject.nullifierHash,
      commitmentHash: credential.credentialSubject.commitmentHash,
      metadataUri: credential.id,
      accepted: result.status !== 'duplicate',
      reason: result.status === 'duplicate' ? 'DUPLICATE_CLAIM' : undefined,
      timestamp: credential.proof.created
    });
  }

  return {
    credentials,
    verifierResults,
    events,
    metrics: buildAuditMetrics(events),
    sampleCredentialJson: JSON.stringify(first, null, 2)
  };
}

async function issueDemoCredential(input) {
  const issuedAt = '2026-06-23T00:00:00.000Z';
  const credential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://civicproof.example/context/v1'
    ],
    id: `urn:civicproof:credential:${input.programId}:${input.nullifierHash.slice(2, 18)}`,
    type: ['VerifiableCredential', 'CivicProofDuplicateBenefitCredential'],
    issuer: demoIssuer.did,
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
      verificationMethod: `${demoIssuer.did}#ed25519-demo`,
      proofValue: ''
    }
  };
  const signature = await ed25519.signAsync(
    encoder.encode(canonicalizeCredentialForSigning(unsignedCredential(credential))),
    hexToBytes(demoIssuer.privateKeyHex)
  );
  credential.proof.proofValue = bytesToHex(signature);
  return credential;
}

async function verifySignedCredential(credential, options) {
  if (!credential || credential.issuer !== options.issuerDid) {
    return { valid: false, reason: 'WRONG_ISSUER' };
  }
  if (
    !credential.expirationDate ||
    !credential.proof ||
    credential.proof.type !== 'Ed25519Signature2020Demo' ||
    !isHex(credential.proof.proofValue, 128) ||
    !isHex(options.publicKeyHex, 64) ||
    !credential.credentialSubject?.programId ||
    !credential.credentialSubject?.nullifierHash ||
    !credential.credentialSubject?.commitmentHash
  ) {
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
    encoder.encode(canonicalizeCredentialForSigning(unsignedCredential(credential))),
    hexToBytes(options.publicKeyHex)
  );
  return verified ? { valid: true } : { valid: false, reason: 'TAMPERED' };
}

function canonicalizeCredentialForSigning(value) {
  return JSON.stringify(sortForCanonicalJson(value));
}

function unsignedCredential(credential) {
  return {
    ...credential,
    proof: {
      ...credential.proof,
      proofValue: undefined
    }
  };
}

function sortForCanonicalJson(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sortForCanonicalJson(entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortForCanonicalJson(entry)])
    );
  }
  return value;
}

async function sha256Hex(value) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(`civicproof:nullifier:v1\0${value}`));
  return `0x${bytesToHex(new Uint8Array(digest))}`;
}

function resultMessage(status) {
  return {
    normal: 'Credential signature is valid, current, and not seen before.',
    duplicate: 'Credential is signed but the program/nullifier pair was already audited.',
    expired: 'Credential signature is intact, but the credential is expired.',
    tampered: 'Credential cannot be trusted because JSON, issuer, proof, or signed fields failed verification.'
  }[status];
}

function isHex(value, hexLength) {
  return new RegExp(`^[0-9a-fA-F]{${hexLength}}$`).test(value);
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  if (hex.length % 2 !== 0) {
    throw new Error('hex input must contain an even number of characters');
  }
  return Uint8Array.from(hex.match(/.{1,2}/g).map((byte) => Number.parseInt(byte, 16)));
}
