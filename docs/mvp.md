# CivicProof Ledger MVP

CivicProof Ledger demonstrates duplicate-benefit prevention without storing personal data in the public registry.

## Components

- `createNullifier` derives a deterministic `0x`-prefixed SHA-256 digest from `programId`, `subjectId`, and an agency salt. The same subject can be checked within a program, while different programs produce different nullifiers.
- `InMemoryClaimRegistry` accepts the first `(programId, nullifierHash)` pair and records later attempts as duplicate audit events.
- `issueCredential` creates an unsigned demo VC envelope containing only DID, program, nullifier, commitment, and expiration fields.
- `verifyCredential` performs minimal demo validation and expiration checks.
- `runDemoScenario` registers two accepted claims and one duplicate, then prints a public audit summary.
- `contracts/ClaimRegistry.sol` mirrors the registry behavior for an on-chain deployment path.

## Privacy Boundary

The public registry stores:

- Program identifier.
- Nullifier hash.
- Commitment hash.
- Metadata URI.

The public registry does not store names, resident registration numbers, birth dates, raw subject IDs, or other direct PII.

## Commands

```sh
npm test
npm run build
npm run demo
npm run demo -- --json
```
