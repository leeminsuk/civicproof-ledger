# CivicProof Ledger Architecture

CivicProof Ledger demonstrates privacy-preserving duplicate-benefit detection for public grants, contests, scholarships, and vouchers.

## Components

- `src/ledger.ts` provides deterministic, program-scoped nullifier hashing and an in-memory audit registry for demo and tests.
- `src/vc.ts` issues and verifies demo Ed25519-signed verifiable credential envelopes using `@noble/ed25519` and canonical JSON.
- `contracts/ClaimRegistry.sol` stores public nullifier commitments by program on an EVM-compatible registry and emits audit events. The contest demo keeps registration permissionless for reproducible local tests; production deployment should add issuer allowlisting or role-based access control before accepting real claims.
- `web/` is a static verifier and audit UI. It uses no React runtime and exercises pure verifier state in Vitest.
- `harness/evaluate_submission.py` scores contest-readiness artifacts and guards against regression to unsigned proofs.

## Data Flow

1. An issuer derives a program-scoped nullifier from private applicant data and a secret salt.
2. The issuer signs a credential containing only a subject DID, program ID, nullifier hash, commitment hash, expiration, and proof metadata.
3. The verifier checks issuer DID, expiration, canonical signed payload, and Ed25519 signature.
4. The registry accepts the first program/nullifier pair and records duplicate attempts as public audit events.
5. Public audit metrics expose accepted claim count, duplicate attempts, represented programs, and `0` stored PII fields.

The VC proof type is explicit: `Ed25519Signature2020Demo`. It is a contest demo proof and is not represented as full W3C production compliance.
