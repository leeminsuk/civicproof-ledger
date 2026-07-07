# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅        |
| < 1.0   | ❌        |

## Reporting a Vulnerability

Please do **not** open a public issue for security problems.

- Preferred: use GitHub **Private vulnerability reporting** on this repository (Security tab → Report a vulnerability).
- Alternative: email `lms040608@gmail.com` with subject `[civicproof-ledger security]`.

You can expect an acknowledgement within **72 hours** and a fix or mitigation plan within **14 days** for confirmed issues. Coordinated disclosure is appreciated; we will credit reporters in the changelog unless you prefer otherwise.

## Scope and Known Boundaries

This project is a verifiable prototype and is explicit about its cryptographic boundaries (see `docs/security.md`):

- `Ed25519Signature2020Demo` demonstrates canonical-JSON signing, not full W3C VC Data Model conformance.
- The Schnorr-style NIZK and Merkle inclusion proof are demo-grade; production deployments must replace them with audited Semaphore/Noir circuits.
- Issuer private keys in demos are deterministic test keys and must never be reused outside tests.

Reports that break the documented threat model (for example, forging a credential that verifies, smuggling a claim past Replay-Verify, or linking one citizen across programs from public data alone) are always in scope — the red-team corpus in `src/attackCorpus.ts` encodes exactly these questions, and a reproducible attack script is the ideal report format.
