# CivicProof Ledger

Privacy-preserving duplicate-benefit verification ledger for public grants, contests, scholarships, and vouchers.

## Contest-Ready Demo

This repository provides:

- Deterministic, program-scoped nullifier hashing with no raw personal data in the public identifier.
- An in-memory claim registry that accepts first claims, rejects duplicates, and exposes audit events plus summary stats.
- Demo Ed25519-signed verifiable credential issue and verify helpers using `@noble/ed25519`.
- A static verifier and public audit UI under `web/`.
- A Solidity `ClaimRegistry` with owner-managed issuer allowlist, authorized issuer checks, and zero-value input validation.
- Hardhat tests for deployment, issuer role-based access control, duplicate detection, and read paths.
- A demo CLI scenario with two accepted claims and one duplicate rejection.
- A contest harness that checks tests, CI, SBOM, Pages workflow, safe web rendering, and final DOCX placeholder hygiene.

The credential proof type is `Ed25519Signature2020Demo`. It demonstrates canonical JSON signing and verification, not full production W3C VC compliance.

## Commands

```sh
npm ci
npm test
npm run build
npm run test:contracts
npm run demo
npm run evaluate
npm audit
```

For a machine-readable demo result:

```sh
npm run demo -- --json
```

To serve the static web verifier locally:

```sh
python3 -m http.server 4173 --directory web
```

Then open `http://127.0.0.1:4173/`. The repository also includes `.github/workflows/pages.yml` to publish `web/` with GitHub Pages.

## Submission Evidence

- CI: GitHub Actions runs `npm test`, `npm run build`, `npm run test:contracts`, `npm run demo`, `npm run evaluate`, and `npm audit`.
- Contract hardening: only an authorized issuer can register a claim; the owner can authorize or revoke issuers.
- Privacy boundary: public state stores only program IDs, nullifier hashes, commitment hashes, metadata URIs, counters, and audit events. Raw identifiers stay off-chain.
- Final checklist: see [docs/final-submission-checklist.md](docs/final-submission-checklist.md).

More implementation notes are in [docs/architecture.md](docs/architecture.md), [docs/security.md](docs/security.md), and [docs/demo-script.md](docs/demo-script.md).
