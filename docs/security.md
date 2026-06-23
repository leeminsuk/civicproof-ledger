# Security Notes

## What This Demo Protects

- Raw applicant identifiers are never stored in registry records or contract state.
- Nullifiers are program-scoped, so a duplicate in one program does not block a separate program.
- Credential verification detects tampered signed fields, wrong issuer DID, expired credentials, malformed proof material, and malformed JSON in the web verifier.
- Audit events are returned as snapshots to prevent callers mutating registry history in memory.
- The Solidity registry uses an issuer allowlist: only an authorized issuer can call `registerClaim`, and the owner can revoke agency keys.
- The web UI renders event data with DOM nodes and `textContent`, not `innerHTML`.

## Cryptography

Credentials are signed with Ed25519 via `@noble/ed25519`. The signed payload is canonical JSON with sorted object keys and the proof value omitted before signing. This avoids demo-only string-order ambiguity while keeping the proof type explicit as `Ed25519Signature2020Demo`.

## Role-Based Access Control

`ClaimRegistry` implements a minimal owner-managed role-based access control model for contest reproducibility:

- `owner` is the deployer.
- The deployer starts as an authorized issuer.
- `authorizeIssuer(issuer, true)` grants an agency or verifier writer key permission to register claims.
- `authorizeIssuer(issuer, false)` revokes that permission.
- Unauthorized registration attempts revert with `UnauthorizedIssuer` before counters, claims, or events are updated.
- Zero program IDs, nullifiers, commitments, and empty metadata URIs revert with `InvalidInput`.

For production, the owner should be a multisig or DAO-controlled account. Issuer keys should be stored in a hardware-backed or cloud KMS environment, rotated on incident, and monitored by off-chain audit tooling.

## Non-Goals

This repository does not claim production W3C VC compliance, DID resolution, secure issuer key custody, zero-knowledge proof generation, or privacy against weak salts. Production use would require formal threat modeling, DID/key management, replay rules, monitoring, independent cryptographic review, and a formal issuer onboarding policy.
