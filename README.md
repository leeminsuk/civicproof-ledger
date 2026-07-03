# CivicProof Ledger

Commitment-based duplicate-benefit verification ledger for public grants, contests, scholarships, and vouchers. The demo keeps raw personal data off-chain and uses program-scoped nullifiers; full zero-knowledge proof integration is documented as a production roadmap item rather than claimed in this prototype.

## Three Verifiable Differentiators

1. **Replay-Verify Engine** (`src/replay.ts`) — anyone can re-derive the entire ledger state from the public audit-event log alone and compare deterministic state roots. Counter tampering, smuggled claims, commitment swaps, and forged duplicate events all surface as typed divergences. A Hardhat test replays real on-chain events back into the exact contract counters.
2. **Civic Integrity Index (cii-v1)** (`src/integrityIndex.ts`) — a deterministic 0-100 score (audit consistency 40, duplicate containment 30, credential integrity 20, privacy minimization 10). No model, no randomness: two independent auditors reproduce the identical number from public data.
3. **Red-Team Attack Corpus** (`src/attackCorpus.ts`, `npm run redteam`) — 12 executable attack scenarios across credential, ledger, proof, audit-log, and privacy categories. CI fails unless 100% are blocked, so any regression that weakens a defense breaks the build.

## Contest-Ready Demo

This repository provides:

- Deterministic, program-scoped nullifier hashing with no raw personal data in the public identifier.
- An in-memory claim registry that accepts first claims, rejects duplicates, and exposes audit events plus summary stats.
- Demo Ed25519-signed verifiable credential issue and verify helpers using `@noble/ed25519` with RFC8785-compatible JSON canonicalization via `json-canonicalize`.
- A Merkle inclusion proof helper for nullifier audit reproducibility. This is intentionally labeled as an inclusion proof, not a zero-knowledge proof.
- A dependency-light Schnorr-style non-interactive proof demo (`src/zkProof.ts`) that proves knowledge of a nullifier secret without placing the subject secret in the proof object. Production should still replace this with audited Semaphore/Noir circuits.
- A static verifier and public audit UI under `web/`.
- A Solidity `ClaimRegistry` with owner-managed issuer allowlist, authorized issuer checks, ownership transfer for multisig/governance migration, program-level duplicate counters, and zero-value input validation.
- Hardhat tests for deployment, issuer role-based access control, ownership transfer, duplicate detection, program-level duplicate accounting, and read paths.
- A demo CLI scenario with two accepted claims and one duplicate rejection, ending with a Replay-Verify MATCH and a Civic Integrity Index of 100/100 EXCELLENT.
- A vendored `web/vendor/noble-ed25519.js` (MIT) so the GitHub Pages demo works without `node_modules` — the import map resolves inside the published site.
- A contest harness that checks tests, CI, SBOM, Pages workflow, safe web rendering, and final DOCX placeholder hygiene.
- A local deployment script, `npm run deploy:local`, with a checked deployment artifact under `docs/deployments/`.

The credential proof type is `Ed25519Signature2020Demo`. It demonstrates canonical JSON signing and verification, not full production W3C VC compliance.

## Commands

```sh
npm ci
npm test
npm run build
npm run test:contracts
npm run demo
npm run redteam
npm run deploy:local
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

- CI: GitHub Actions runs `npm test`, `npm run build`, `npm run test:contracts`, `npm run demo`, `npm run redteam`, `npm run evaluate`, and `npm audit`.
- Contract hardening: only an authorized issuer can register a claim; the owner can authorize or revoke issuers.
- Privacy boundary: public state stores only program IDs, nullifier hashes, commitment hashes, metadata URIs, counters, and audit events. Raw identifiers stay off-chain.
- Final checklist: see [docs/final-submission-checklist.md](docs/final-submission-checklist.md).

More implementation notes are in [docs/architecture.md](docs/architecture.md), [docs/security.md](docs/security.md), and [docs/demo-script.md](docs/demo-script.md).
