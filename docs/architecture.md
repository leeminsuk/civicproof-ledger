# CivicProof Ledger Architecture

CivicProof Ledger demonstrates commitment-based duplicate-benefit detection for public grants, contests, scholarships, and vouchers. It intentionally avoids storing raw personal data on-chain. The current contest prototype uses program-scoped nullifier hashes and Ed25519 signed credentials; ZK proofs such as Semaphore/Noir are a documented next-stage hardening item, not a hidden runtime dependency.

## Components

- `src/ledger.ts` provides deterministic, program-scoped nullifier hashing and an in-memory audit registry for demo and tests.
- `src/vc.ts` issues and verifies demo Ed25519-signed verifiable credential envelopes using `@noble/ed25519` and canonical JSON.
- `src/vc.ts` now delegates signing serialization to `json-canonicalize` for RFC8785-compatible JSON canonicalization instead of relying on a homegrown key sorter.
- `src/nullifierProof.ts` builds and verifies Merkle inclusion proofs for audit reproducibility. It does not claim ZK anonymity; it documents the bridge toward Semaphore/Noir-style proofs.
- `src/zkProof.ts` adds an executable Schnorr-style NIZK demo proof. It proves knowledge of a secret linked to a program nullifier without serializing the subject identifier, while preserving a clear production warning to replace it with audited Semaphore/Noir circuits.
- `contracts/ClaimRegistry.sol` stores public nullifier commitments by program on an EVM-compatible registry, emits audit events, enforces an owner-managed issuer allowlist before accepting claim registration, supports ownership transfer for multisig/governance migration, and exposes per-program duplicate counters.
- `tests/contracts/ClaimRegistry.test.js` verifies deployer authorization, owner-only issuer updates, ownership transfer, authorized issuer registration, unauthorized rejection, duplicate accounting, program-level duplicate counts, program isolation, and invalid-input reverts.
- `web/` is a static verifier and audit UI. It uses no React runtime, avoids `innerHTML`, and exercises pure verifier state in Vitest.
- `.github/workflows/pages.yml` publishes `web/` to GitHub Pages on pushes to `main`.
- `harness/evaluate_submission.py` scores contest-readiness artifacts and guards against regression to unsigned proofs, unsafe web rendering, missing issuer access control, missing Pages deployment, and stale final DOCX placeholders.
- `scripts/deploy-claim-registry.js` provides a reproducible Hardhat deployment path; `docs/deployments/local-hardhat-claim-registry.json` records the local proof-of-deploy artifact.

## Data Flow

1. An authorized issuer derives a program-scoped nullifier from private applicant data and a secret salt.
2. The issuer signs a credential containing only a subject DID, program ID, nullifier hash, commitment hash, expiration, and proof metadata.
3. The verifier checks issuer DID, expiration, canonical signed payload, and Ed25519 signature.
4. The owner-managed issuer allowlist decides who may write to the on-chain registry. Unauthorized accounts revert with `UnauthorizedIssuer` before state changes.
5. The registry accepts the first program/nullifier pair and records duplicate attempts as public audit events.
6. Public audit metrics expose accepted claim count, total duplicate attempts, per-program duplicate counters, represented programs, and `0` stored PII fields.

## Access Control Model

- `owner()` is set to the deployer.
- The deployer is authorized as the first issuer at construction time.
- `authorizeIssuer(address issuer, bool authorized)` is owner-only and emits `IssuerAuthorizationUpdated`.
- `registerClaim(...)` is restricted to authorized issuers and validates non-zero `programId`, `nullifierHash`, `commitmentHash`, and non-empty `metadataUri`.
- Production deployments should immediately transfer `owner` to a multisig or governance account via `transferOwnership`. The transfer revokes the previous owner issuer flag and authorizes the new owner, then later issuer authorization can be rotated when an agency key is compromised.

The VC proof type is explicit: `Ed25519Signature2020Demo`. It is a contest demo proof and is not represented as full W3C production compliance.


## Integrity Engines (differentiator layer)

### Replay-Verify Engine (`src/replay.ts`)

The public audit-event log is the single source of truth. `replayAuditEvents`
folds the log into claims, per-program counters, and a domain-separated
SHA-256 state root (`civicproof:state-root:v1`, order-independent).
`verifyLedgerReplay` compares that replayed state with the live ledger
snapshot and emits typed divergences:

| Divergence | Detected manipulation |
| --- | --- |
| `TOTAL_CLAIMS_MISMATCH` / `DUPLICATE_ATTEMPTS_MISMATCH` / `PROGRAM_COUNT_MISMATCH` | Counter tampering |
| `CLAIM_MISSING_IN_LIVE` | Deleted claims |
| `CLAIM_NOT_IN_REPLAY` | Claims smuggled in without audit events |
| `COMMITMENT_MISMATCH` | Post-hoc commitment swaps |
| `EVENT_ORDER_VIOLATION` | Forged duplicate events with no prior registration |
| `STATE_ROOT_MISMATCH` | Any residual state divergence |

The same replay runs against the EVM layer: a Hardhat test queries
`ClaimRegistered`/`DuplicateDetected` events and reproduces `totalClaims`,
`duplicateAttempts`, and both per-program counters exactly.

### Civic Integrity Index (`src/integrityIndex.ts`, formula `cii-v1`)

Deterministic 0-100 score with frozen weights: audit consistency 40 (replay
MATCH), duplicate containment 30 (every duplicate attempt rejected with an
audit event), credential integrity 20 (valid-signature share), privacy
minimization 10 (zero PII fields on the public ledger). Grades: >=90
EXCELLENT, >=75 GOOD, >=50 WATCH, else ALERT. The browser mirror in
`web/verifier.js` reproduces the identical score client-side.

### Red-Team Attack Corpus (`src/attackCorpus.ts`)

Twelve adversarial scenarios (ATK-01..ATK-12) covering credential tampering,
signature stripping, issuer key forgery, DID substitution, expired replay,
same-program nullifier replay, cross-program linkage, malformed input
injection, Schnorr forgery and cross-program proof replay, Merkle path
forgery, and audit-log forgery. `npm run redteam` exits non-zero unless
12/12 are blocked, and CI runs it on every push.
