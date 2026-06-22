import { createHash } from 'node:crypto';

export interface NullifierInput {
  programId: string;
  subjectId: string;
  salt: string;
}

export interface ClaimInput {
  programId: string;
  nullifierHash: string;
  commitmentHash: string;
  metadataUri: string;
}

export interface ClaimRecord extends ClaimInput {
  registeredAt: string;
}

export interface AuditEvent {
  event: 'ClaimRegistered' | 'DuplicateDetected';
  programId: string;
  nullifierHash: string;
  commitmentHash: string;
  metadataUri: string;
  accepted: boolean;
  timestamp: string;
  reason?: 'DUPLICATE_CLAIM';
}

export interface ClaimResult {
  accepted: boolean;
  event: AuditEvent;
  reason?: 'DUPLICATE_CLAIM';
}

export interface RegistryStats {
  totalClaims: number;
  duplicateAttempts: number;
  programs: number;
}

export function createNullifier(input: NullifierInput): string {
  const digest = createHash('sha256')
    .update('civicproof:nullifier:v1')
    .update('\0')
    .update(input.programId)
    .update('\0')
    .update(input.subjectId)
    .update('\0')
    .update(input.salt)
    .digest('hex');

  return `0x${digest}`;
}

export class InMemoryClaimRegistry {
  private readonly claims = new Map<string, ClaimRecord>();
  private readonly events: AuditEvent[] = [];
  private duplicateAttempts = 0;

  registerClaim(input: ClaimInput): ClaimResult {
    const key = this.claimKey(input.programId, input.nullifierHash);
    const timestamp = new Date().toISOString();

    if (this.claims.has(key)) {
      this.duplicateAttempts += 1;
      const event: AuditEvent = {
        event: 'DuplicateDetected',
        ...input,
        accepted: false,
        reason: 'DUPLICATE_CLAIM',
        timestamp
      };
      this.events.push(event);

      return { accepted: false, reason: 'DUPLICATE_CLAIM', event };
    }

    this.claims.set(key, { ...input, registeredAt: timestamp });
    const event: AuditEvent = {
      event: 'ClaimRegistered',
      ...input,
      accepted: true,
      timestamp
    };
    this.events.push(event);

    return { accepted: true, event };
  }

  auditEvents(): AuditEvent[] {
    return [...this.events];
  }

  stats(): RegistryStats {
    return {
      totalClaims: this.claims.size,
      duplicateAttempts: this.duplicateAttempts,
      programs: new Set([...this.claims.values()].map((claim) => claim.programId)).size
    };
  }

  private claimKey(programId: string, nullifierHash: string): string {
    return `${programId}:${nullifierHash.toLowerCase()}`;
  }
}
