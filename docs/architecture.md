# CivicProof Ledger Architecture

CivicProof Ledger demonstrates privacy-preserving duplicate-benefit detection for public grants, contests, scholarships, and vouchers.

## Components

- `src/ledger.ts` provides deterministic, program-scoped nullifier hashing and an in-memory audit registry for demo and tests.
- `src/vc.ts` issues and verifies demo Ed25519-signed verifiable credential envelopes using `@noble/ed25519` and canonical JSON.
- `contracts/ClaimRegistry.sol` stores public nullifier commitments by program on an EVM-compatible registry, emits audit events, and enforces an owner-managed issuer allowlist before accepting claim registration.
- `tests/contracts/ClaimRegistry.test.js` verifies deployer authorization, owner-only issuer updates, authorized issuer registration, unauthorized rejection, duplicate accounting, program isolation, and invalid-input reverts.
- `web/` is a static verifier and audit UI. It uses no React runtime, avoids `innerHTML`, and exercises pure verifier state in Vitest.
- `.github/workflows/pages.yml` publishes `web/` to GitHub Pages on pushes to `main`.
- `harness/evaluate_submission.py` scores contest-readiness artifacts and guards against regression to unsigned proofs, unsafe web rendering, missing issuer access control, missing Pages deployment, and stale final DOCX placeholders.

## Data Flow

1. An authorized issuer derives a program-scoped nullifier from private applicant data and a secret salt.
2. The issuer signs a credential containing only a subject DID, program ID, nullifier hash, commitment hash, expiration, and proof metadata.
3. The verifier checks issuer DID, expiration, canonical signed payload, and Ed25519 signature.
4. The owner-managed issuer allowlist decides who may write to the on-chain registry. Unauthorized accounts revert with `UnauthorizedIssuer` before state changes.
5. The registry accepts the first program/nullifier pair and records duplicate attempts as public audit events.
6. Public audit metrics expose accepted claim count, duplicate attempts, represented programs, and `0` stored PII fields.

## Access Control Model

- `owner()` is set to the deployer.
- The deployer is authorized as the first issuer at construction time.
- `authorizeIssuer(address issuer, bool authorized)` is owner-only and emits `IssuerAuthorizationUpdated`.
- `registerClaim(...)` is restricted to authorized issuers and validates non-zero `programId`, `nullifierHash`, `commitmentHash`, and non-empty `metadataUri`.
- Production deployments should operate the owner key through a multisig or governance account and rotate issuer authorization when an agency key is compromised.

The VC proof type is explicit: `Ed25519Signature2020Demo`. It is a contest demo proof and is not represented as full W3C production compliance.
