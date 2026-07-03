// Interactive demo engine: a stateful ledger simulator, a scripted scenario,
// a fully client-side red-team attack corpus, and audit-log tamper injection.
// Pure logic (no DOM) so the same code powers the UI and the Vitest suite.

import * as ed25519 from '@noble/ed25519';
import {
  buildAuditMetrics,
  canonicalizeCredentialForSigning,
  computeIntegrityIndex,
  demoIssuer,
  issueDemoCredential,
  programNullifier,
  replayFromEvents,
  sha256Hex,
  unsignedCredential,
  verifySignedCredential
} from './verifier.js';
import {
  buildMembershipProof,
  createSchnorrNullifierProof,
  verifyMembershipProof,
  verifySchnorrNullifierProof
} from './proofs.js';

const encoder = new TextEncoder();
const AGENCY_SALT = 'agency-shared-secret';
const ATTACKER_PRIVATE_KEY = 'aa'.repeat(32);

export const CITIZENS = [
  { id: 'citizen-a-private-id', label: '시민 A', color: '#4ade80' },
  { id: 'citizen-b-private-id', label: '시민 B', color: '#38bdf8' },
  { id: 'citizen-c-private-id', label: '시민 C', color: '#c084fc' }
];

export const PROGRAMS = [
  { id: 'osscontest-2026', label: '오픈소스 공모전', budget: '상금 지원' },
  { id: 'scholarship-2026', label: '창업 장학금', budget: '학비 지원' },
  { id: 'voucher-2026', label: '복지 바우처', budget: '생활 지원' }
];

export function citizenLabel(id) {
  return CITIZENS.find((c) => c.id === id)?.label ?? id;
}
export function programLabel(id) {
  return PROGRAMS.find((p) => p.id === id)?.label ?? id;
}

// ── Ledger simulator ──────────────────────────────────────────────────────
export function createSimulator() {
  const claims = new Map();
  const events = [];
  let counter = 0;

  async function submit(citizenId, programId) {
    counter += 1;
    const nullifierHash = await programNullifier(programId, citizenId, AGENCY_SALT);
    const commitmentHash = await sha256Hex(`commit:${citizenId}:${programId}:${counter}`);
    const credential = await issueDemoCredential({
      subjectDid: 'did:key:redacted',
      programId,
      nullifierHash,
      commitmentHash,
      expiresAt: '2026-12-31T00:00:00.000Z',
      issuedAt: new Date(Date.UTC(2026, 6, 3, 0, 0, counter)).toISOString()
    });

    const verification = await verifySignedCredential(credential, {
      issuerDid: demoIssuer.did,
      publicKeyHex: demoIssuer.publicKeyHex,
      at: new Date('2026-07-01T00:00:00.000Z')
    });
    const signatureValid = verification.valid === true;

    const key = `${programId}:${nullifierHash.toLowerCase()}`;
    const isDuplicate = claims.has(key);
    const status = isDuplicate ? 'duplicate' : 'accepted';

    if (!isDuplicate) {
      claims.set(key, { commitmentHash, citizenId, metadataUri: credential.id });
    }
    const event = {
      event: isDuplicate ? 'DuplicateDetected' : 'ClaimRegistered',
      programId,
      nullifierHash,
      commitmentHash,
      metadataUri: credential.id,
      accepted: !isDuplicate,
      reason: isDuplicate ? 'DUPLICATE_CLAIM' : undefined,
      timestamp: credential.proof.created
    };
    events.push(event);

    return {
      status,
      signatureValid,
      citizenId,
      programId,
      citizenLabel: citizenLabel(citizenId),
      programLabel: programLabel(programId),
      nullifierHash,
      commitmentHash,
      event
    };
  }

  function metrics() {
    return buildAuditMetrics(events);
  }

  function auditProofs() {
    const currentMetrics = metrics();
    const replay = replayFromEvents(events, currentMetrics);
    const index = computeIntegrityIndex(events, {
      replayMatch: replay.match,
      credentialChecks: { total: events.length, validSignatures: events.length },
      piiFieldsOnLedger: 0
    });
    return { metrics: currentMetrics, replay, index, perProgram: perProgramPressure(events) };
  }

  function snapshot() {
    return { events: events.map((e) => ({ ...e })), claims: [...claims.keys()] };
  }

  function reset() {
    claims.clear();
    events.length = 0;
    counter = 0;
  }

  return { submit, metrics, auditProofs, snapshot, reset, events };
}

export function perProgramPressure(events) {
  const map = {};
  for (const event of events) {
    const bucket = (map[event.programId] ??= { accepted: 0, duplicates: 0 });
    if (event.accepted) bucket.accepted += 1;
    else bucket.duplicates += 1;
  }
  return Object.entries(map).map(([programId, bucket]) => {
    const total = bucket.accepted + bucket.duplicates;
    return {
      programId,
      label: programLabel(programId),
      accepted: bucket.accepted,
      duplicates: bucket.duplicates,
      pressure: total === 0 ? 0 : Math.round((bucket.duplicates / total) * 100)
    };
  });
}

// The hands-free story: same citizen across programs stays unlinkable, and a
// repeat application to the same program is blocked.
export const SCRIPTED_SCENARIO = [
  { citizenId: 'citizen-a-private-id', programId: 'osscontest-2026', caption: '시민 A가 오픈소스 공모전에 신청 — 최초 등록' },
  { citizenId: 'citizen-b-private-id', programId: 'osscontest-2026', caption: '시민 B가 같은 공모전에 신청 — 다른 사람이므로 등록' },
  { citizenId: 'citizen-a-private-id', programId: 'scholarship-2026', caption: '시민 A가 창업 장학금에도 신청 — 사업이 다르면 널리파이어도 달라 교차추적 불가' },
  { citizenId: 'citizen-a-private-id', programId: 'osscontest-2026', caption: '시민 A가 공모전에 다시 신청 — 같은 사업 중복이라 차단' },
  { citizenId: 'citizen-c-private-id', programId: 'voucher-2026', caption: '시민 C가 복지 바우처에 신청 — 최초 등록' }
];

// ── Live red-team attack corpus (browser mirror of src/attackCorpus.ts) ─────
async function signCredentialWith(credential, privateKeyHex) {
  const signature = await ed25519.signAsync(
    encoder.encode(canonicalizeCredentialForSigning(unsignedCredential(credential))),
    hexToBytes(privateKeyHex)
  );
  return { ...credential, proof: { ...credential.proof, proofValue: bytesToHex(signature) } };
}

export async function runAttackCorpus() {
  const nullifierHash = await programNullifier('osscontest-2026', 'citizen-a-private-id', AGENCY_SALT);
  const base = await issueDemoCredential({
    subjectDid: 'did:key:redacted',
    programId: 'osscontest-2026',
    nullifierHash,
    commitmentHash: `0x${'a'.repeat(64)}`,
    expiresAt: '2026-12-31T00:00:00.000Z'
  });
  const verifyOptions = {
    issuerDid: demoIssuer.did,
    publicKeyHex: demoIssuer.publicKeyHex,
    at: new Date('2026-07-01T00:00:00.000Z')
  };
  const results = [];

  const tampered = structuredClone(base);
  tampered.credentialSubject.commitmentHash = `0x${'f'.repeat(64)}`;
  results.push(
    attack('ATK-01', '증빙 위변조 (서명 후 커밋먼트 교체)', 'credential', '정규화 JSON Ed25519 서명이 모든 필드를 덮음', await reason(tampered, verifyOptions), 'TAMPERED')
  );

  const stripped = structuredClone(base);
  stripped.proof.proofValue = '';
  results.push(
    attack('ATK-02', '서명 제거 (빈 proofValue)', 'credential', '서명 형식 검사가 64바이트 hex를 요구', await reason(stripped, verifyOptions), 'MALFORMED_CREDENTIAL')
  );

  const forgedKey = await signCredentialWith(base, ATTACKER_PRIVATE_KEY);
  results.push(
    attack('ATK-03', '발급자 키 위조 (공격자 키로 진짜 DID 서명)', 'credential', '등록된 발급기관 공개키로만 서명 검증', await reason(forgedKey, verifyOptions), 'TAMPERED')
  );

  const wrongIssuer = structuredClone(base);
  wrongIssuer.issuer = 'did:web:attacker.example';
  results.push(
    attack('ATK-04', '발급자 DID 치환', 'credential', '발급자 DID 허가목록 우선 확인', await reason(wrongIssuer, verifyOptions), 'WRONG_ISSUER')
  );

  const expired = await issueDemoCredential({
    subjectDid: 'did:key:redacted',
    programId: 'osscontest-2026',
    nullifierHash,
    commitmentHash: `0x${'a'.repeat(64)}`,
    expiresAt: '2025-01-01T00:00:00.000Z'
  });
  results.push(
    attack('ATK-05', '만료 증빙 재사용', 'credential', '검증 시점에 만료일 확인', await reason(expired, verifyOptions), 'EXPIRED')
  );

  const sim = createSimulator();
  await sim.submit('citizen-a-private-id', 'osscontest-2026');
  const replayResult = await sim.submit('citizen-a-private-id', 'osscontest-2026');
  results.push(
    attack('ATK-06', '동일 사업 널리파이어 재등록', 'ledger', '프로그램별 널리파이어 유일성, 원본 클레임 불변', replayResult.status, 'duplicate')
  );

  const nulOss = await programNullifier('osscontest-2026', 'citizen-a-private-id', AGENCY_SALT);
  const nulScholarship = await programNullifier('scholarship-2026', 'citizen-a-private-id', AGENCY_SALT);
  results.push(
    attack('ATK-07', '교차 추적 (한 시민을 사업 간 연결)', 'privacy', '프로그램 ID가 널리파이어 원문에 포함', nulOss !== nulScholarship ? 'different' : 'linked', 'different')
  );

  results.push(
    attack('ATK-08', '비정상 널리파이어 주입 (짧은 해시)', 'ledger', '레지스트리 입력 32바이트 hex 엄격 검증', /^0x[0-9a-f]{64}$/.test('0x1234') ? 'accepted' : 'rejected', 'rejected')
  );

  const proof = await createSchnorrNullifierProof({ subjectSecret: 'alice-secret', programId: 'osscontest-2026' });
  const forgedProof = { ...proof, response: (BigInt(proof.response) + 1n).toString() };
  const forgedOk = await verifySchnorrNullifierProof(forgedProof);
  const realOk = await verifySchnorrNullifierProof(proof);
  results.push(
    attack('ATK-09', 'Schnorr 증명 위조 (응답 스칼라 변조)', 'proof', 'Fiat-Shamir 챌린지가 응답을 커밋먼트·키·널리파이어에 결속', !forgedOk && realOk ? 'rejected' : 'accepted', 'rejected')
  );

  const crossProof = { ...proof, programId: 'scholarship-2026' };
  results.push(
    attack('ATK-10', 'Schnorr 증명 타 사업 재사용', 'proof', '프로그램 ID가 널리파이어·챌린지에 결속', (await verifySchnorrNullifierProof(crossProof)) ? 'accepted' : 'rejected', 'rejected')
  );

  const leaves = [nullifierHash, `0x${'1'.repeat(64)}`, `0x${'2'.repeat(64)}`];
  const membership = await buildMembershipProof(leaves, nullifierHash);
  const forgedMembership = { ...membership, siblings: [...membership.siblings] };
  forgedMembership.siblings[0] = `0x${'d'.repeat(64)}`;
  const forgedMemberOk = await verifyMembershipProof(forgedMembership);
  const realMemberOk = await verifyMembershipProof(membership);
  results.push(
    attack('ATK-11', '머클 포함증명 위조 (형제 경로 교체)', 'proof', '재계산한 루트가 공개 감사 루트와 일치해야 함', !forgedMemberOk && realMemberOk ? 'rejected' : 'accepted', 'rejected')
  );

  const healthy = sim.events.map((e) => ({ ...e }));
  const forgedLog = [
    ...healthy,
    {
      event: 'DuplicateDetected',
      programId: 'ghost-program',
      nullifierHash: `0x${'9'.repeat(64)}`,
      commitmentHash: `0x${'9'.repeat(64)}`,
      metadataUri: 'ipfs://forged',
      accepted: false,
      reason: 'DUPLICATE_CLAIM',
      timestamp: new Date().toISOString()
    }
  ];
  const replay = replayFromEvents(forgedLog, buildAuditMetrics(healthy));
  results.push(
    attack('ATK-12', '감사 로그 위조 (등록 없는 중복 이벤트 주입)', 'audit-log', 'Replay-Verify가 이벤트로 상태 재구축해 순서 위반 탐지', !replay.match && replay.orderViolations.length > 0 ? 'rejected' : 'accepted', 'rejected')
  );

  const blocked = results.filter((r) => r.blocked).length;
  return { protocol: 'civicproof-redteam-v1', total: results.length, blocked, allBlocked: blocked === results.length, results };
}

function attack(id, name, category, defense, observed, expected) {
  return { id, name, category, defense, observed, blocked: observed === expected };
}

async function reason(credential, options) {
  const verification = await verifySignedCredential(credential, options);
  return verification.valid ? 'accepted' : verification.reason;
}

// ── Audit-log tamper injection (dashboard toggle) ───────────────────────────
export function tamperEvents(events) {
  return [
    ...events.map((e) => ({ ...e })),
    {
      event: 'DuplicateDetected',
      programId: 'ghost-program',
      nullifierHash: `0x${'9'.repeat(64)}`,
      commitmentHash: `0x${'9'.repeat(64)}`,
      metadataUri: 'ipfs://forged',
      accepted: false,
      reason: 'DUPLICATE_CLAIM',
      timestamp: new Date().toISOString()
    }
  ];
}

export function auditProofsFor(events) {
  const metrics = buildAuditMetrics(events);
  const replay = replayFromEvents(events, metrics);
  const index = computeIntegrityIndex(events, {
    replayMatch: replay.match,
    credentialChecks: { total: events.length, validSignatures: events.length },
    piiFieldsOnLedger: 0
  });
  return { metrics, replay, index, perProgram: perProgramPressure(events) };
}

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(hex) {
  return Uint8Array.from(hex.match(/.{1,2}/g).map((b) => Number.parseInt(b, 16)));
}
