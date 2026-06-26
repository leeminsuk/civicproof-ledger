# Security Notes

## What This Demo Protects

- Raw applicant identifiers are never stored in registry records or contract state.
- Nullifiers are program-scoped, so a duplicate in one program does not block a separate program.
- Credential verification detects tampered signed fields, wrong issuer DID, expired credentials, malformed proof material, and malformed JSON in the web verifier.
- Audit events are returned as snapshots to prevent callers mutating registry history in memory.
- The Solidity registry uses an issuer allowlist: only an authorized issuer can call `registerClaim`, the owner can revoke agency keys, and ownership can be transferred to a multisig/governance account.
- Program-level duplicate counters let auditors distinguish one program's anomaly from global aggregate noise.
- The web UI renders event data with DOM nodes and `textContent`, not `innerHTML`.

## Cryptography

Credentials are signed with Ed25519 via `@noble/ed25519`. The signed payload is canonical JSON with sorted object keys and the proof value omitted before signing. This avoids demo-only string-order ambiguity while keeping the proof type explicit as `Ed25519Signature2020Demo`.

The canonical JSON step uses the `json-canonicalize` package rather than a homegrown object sorter. The `proofValue` field is removed before canonicalization so a verifier signs and verifies the same payload boundary.

`src/nullifierProof.ts` provides a Merkle inclusion proof for audit reproducibility. It is not a zero-knowledge proof, but it gives the project a concrete proof object and tamper test while keeping the ZK roadmap honest.

`src/zkProof.ts` provides a dependency-light Schnorr-style non-interactive proof of knowledge over an RFC 3526 finite-field group. It proves knowledge of the subject secret behind a program nullifier without putting the subject identifier in the proof object. This is a contest demo proof, not a replacement for a formally audited Semaphore/Noir circuit.

## Role-Based Access Control

`ClaimRegistry` implements a minimal owner-managed role-based access control model for contest reproducibility:

- `owner` is the deployer.
- The deployer starts as an authorized issuer.
- `authorizeIssuer(issuer, true)` grants an agency or verifier writer key permission to register claims.
- `authorizeIssuer(issuer, false)` revokes that permission.
- Unauthorized registration attempts revert with `UnauthorizedIssuer` before counters, claims, or events are updated.
- Zero program IDs, nullifiers, commitments, and empty metadata URIs revert with `InvalidInput`.

For production, the deployer should call `transferOwnership(multisig)` before onboarding real issuers. The transfer automatically deauthorizes the previous owner as an issuer and authorizes the new owner, preventing the deployer key from retaining write access by accident. Issuer keys should be stored in a hardware-backed or cloud KMS environment, rotated on incident, and monitored by off-chain audit tooling. The contest prototype is commitment/nullifier based; if the deployment requires stronger unlinkability against issuer-side salt disclosure, add Semaphore/Noir ZK membership proofs before production rollout.

`deterministicTestKeyPair` is for reproducible tests and demos only. Production issuers must use keys generated and stored outside source control. The deterministic demo issuer key is deliberately labeled as test/demo material; it is not a security claim for production credentials.

## Non-Goals

This repository does not claim production W3C VC compliance, DID resolution, secure issuer key custody, zero-knowledge proof generation, or privacy against weak salts. Production use would require formal threat modeling, DID/key management, replay rules, monitoring, independent cryptographic review, and a formal issuer onboarding policy.
