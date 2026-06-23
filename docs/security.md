# Security Notes

## What This Demo Protects

- Raw applicant identifiers are never stored in registry records or contract state.
- Nullifiers are program-scoped, so a duplicate in one program does not block a separate program.
- Credential verification detects tampered signed fields, wrong issuer DID, expired credentials, malformed proof material, and malformed JSON in the web verifier.
- Audit events are returned as snapshots to prevent callers mutating registry history in memory.

## Cryptography

Credentials are signed with Ed25519 via `@noble/ed25519`. The signed payload is canonical JSON with sorted object keys and the proof value omitted before signing. This avoids demo-only string-order ambiguity while keeping the proof type explicit as `Ed25519Signature2020Demo`.

## Non-Goals

This repository does not claim production W3C VC compliance, DID resolution, secure issuer key custody, zero-knowledge proof generation, or privacy against weak salts. Production use would require formal threat modeling, DID/key management, replay rules, monitoring, and independent cryptographic review.
