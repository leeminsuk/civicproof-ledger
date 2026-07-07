// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import type { AuditEvent, ClaimRecord, RegistryStats } from './ledger.js';

export interface ReplayedClaim {
  programId: string;
  nullifierHash: string;
  commitmentHash: string;
  metadataUri: string;
}

export interface ProgramReplaySummary {
  claims: number;
  duplicateAttempts: number;
}

export interface ReplayedState {
  claims: ReplayedClaim[];
  stats: RegistryStats;
  perProgram: Record<string, ProgramReplaySummary>;
  stateRoot: string;
}

export type ReplayDivergence =
  | { code: 'TOTAL_CLAIMS_MISMATCH'; expected: number; actual: number }
  | { code: 'DUPLICATE_ATTEMPTS_MISMATCH'; expected: number; actual: number }
  | { code: 'PROGRAM_COUNT_MISMATCH'; expected: number; actual: number }
  | { code: 'CLAIM_MISSING_IN_LIVE'; key: string }
  | { code: 'CLAIM_NOT_IN_REPLAY'; key: string }
  | { code: 'COMMITMENT_MISMATCH'; key: string }
  | { code: 'EVENT_ORDER_VIOLATION'; key: string }
  | { code: 'STATE_ROOT_MISMATCH'; expected: string; actual: string };

export interface ReplayVerification {
  match: boolean;
  replayedStateRoot: string;
  liveStateRoot: string;
  divergences: ReplayDivergence[];
}

export interface LiveLedgerSnapshot {
  claims: ClaimRecord[];
  stats: RegistryStats;
}

const STATE_ROOT_DOMAIN = 'civicproof:state-root:v1';

export function replayAuditEvents(events: AuditEvent[]): ReplayedState {
  const claims = new Map<string, ReplayedClaim>();
  const perProgram: Record<string, ProgramReplaySummary> = {};
  const orderViolations: string[] = [];
  let duplicateAttempts = 0;

  for (const event of events) {
    const key = claimKey(event.programId, event.nullifierHash);
    const program = (perProgram[event.programId] ??= { claims: 0, duplicateAttempts: 0 });

    if (event.event === 'ClaimRegistered') {
      claims.set(key, {
        programId: event.programId,
        nullifierHash: event.nullifierHash.toLowerCase(),
        commitmentHash: event.commitmentHash.toLowerCase(),
        metadataUri: event.metadataUri
      });
      program.claims += 1;
    } else {
      if (!claims.has(key)) {
        orderViolations.push(key);
      }
      duplicateAttempts += 1;
      program.duplicateAttempts += 1;
    }
  }

  const sortedClaims = [...claims.values()].sort(compareClaims);
  const stats: RegistryStats = {
    totalClaims: sortedClaims.length,
    duplicateAttempts,
    programs: new Set(sortedClaims.map((claim) => claim.programId)).size
  };

  return {
    claims: sortedClaims,
    stats,
    perProgram,
    stateRoot: computeStateRoot(sortedClaims, stats, orderViolations)
  };
}

export function computeStateRoot(
  claims: ReplayedClaim[],
  stats: RegistryStats,
  orderViolations: string[] = []
): string {
  const hash = createHash('sha256').update(STATE_ROOT_DOMAIN);
  for (const claim of [...claims].sort(compareClaims)) {
    hash
      .update('\0')
      .update(claim.programId)
      .update('\0')
      .update(claim.nullifierHash.toLowerCase())
      .update('\0')
      .update(claim.commitmentHash.toLowerCase())
      .update('\0')
      .update(claim.metadataUri);
  }
  hash
    .update('\0')
    .update(String(stats.totalClaims))
    .update('\0')
    .update(String(stats.duplicateAttempts))
    .update('\0')
    .update(String(stats.programs))
    .update('\0')
    .update(String(orderViolations.length));
  return `0x${hash.digest('hex')}`;
}

export function verifyLedgerReplay(events: AuditEvent[], live: LiveLedgerSnapshot): ReplayVerification {
  const replayed = replayAuditEvents(events);
  const divergences: ReplayDivergence[] = [];

  const seenKeys = new Set<string>();
  for (const event of events) {
    const key = claimKey(event.programId, event.nullifierHash);
    if (event.event === 'DuplicateDetected' && !seenKeys.has(key)) {
      divergences.push({ code: 'EVENT_ORDER_VIOLATION', key });
    }
    if (event.event === 'ClaimRegistered') {
      seenKeys.add(key);
    }
  }

  if (replayed.stats.totalClaims !== live.stats.totalClaims) {
    divergences.push({
      code: 'TOTAL_CLAIMS_MISMATCH',
      expected: replayed.stats.totalClaims,
      actual: live.stats.totalClaims
    });
  }
  if (replayed.stats.duplicateAttempts !== live.stats.duplicateAttempts) {
    divergences.push({
      code: 'DUPLICATE_ATTEMPTS_MISMATCH',
      expected: replayed.stats.duplicateAttempts,
      actual: live.stats.duplicateAttempts
    });
  }
  if (replayed.stats.programs !== live.stats.programs) {
    divergences.push({
      code: 'PROGRAM_COUNT_MISMATCH',
      expected: replayed.stats.programs,
      actual: live.stats.programs
    });
  }

  const liveByKey = new Map(live.claims.map((claim) => [claimKey(claim.programId, claim.nullifierHash), claim]));
  for (const claim of replayed.claims) {
    const key = claimKey(claim.programId, claim.nullifierHash);
    const liveClaim = liveByKey.get(key);
    if (!liveClaim) {
      divergences.push({ code: 'CLAIM_MISSING_IN_LIVE', key });
    } else if (liveClaim.commitmentHash.toLowerCase() !== claim.commitmentHash) {
      divergences.push({ code: 'COMMITMENT_MISMATCH', key });
    }
  }
  for (const claim of live.claims) {
    const key = claimKey(claim.programId, claim.nullifierHash);
    if (!replayed.claims.some((entry) => claimKey(entry.programId, entry.nullifierHash) === key)) {
      divergences.push({ code: 'CLAIM_NOT_IN_REPLAY', key });
    }
  }

  const liveStateRoot = computeStateRoot(
    live.claims.map((claim) => ({
      programId: claim.programId,
      nullifierHash: claim.nullifierHash.toLowerCase(),
      commitmentHash: claim.commitmentHash.toLowerCase(),
      metadataUri: claim.metadataUri
    })),
    live.stats
  );
  if (divergences.length === 0 && liveStateRoot !== replayed.stateRoot) {
    divergences.push({ code: 'STATE_ROOT_MISMATCH', expected: replayed.stateRoot, actual: liveStateRoot });
  }

  return {
    match: divergences.length === 0,
    replayedStateRoot: replayed.stateRoot,
    liveStateRoot,
    divergences
  };
}

function claimKey(programId: string, nullifierHash: string): string {
  return `${programId}:${nullifierHash.toLowerCase()}`;
}

function compareClaims(left: ReplayedClaim, right: ReplayedClaim): number {
  if (left.programId !== right.programId) {
    return left.programId < right.programId ? -1 : 1;
  }
  return left.nullifierHash < right.nullifierHash ? -1 : left.nullifierHash > right.nullifierHash ? 1 : 0;
}
