# CivicProof Ledger

[![CI](https://github.com/leeminsuk/civicproof-ledger/actions/workflows/ci.yml/badge.svg)](https://github.com/leeminsuk/civicproof-ledger/actions/workflows/ci.yml)
[![Pages](https://github.com/leeminsuk/civicproof-ledger/actions/workflows/pages.yml/badge.svg)](https://leeminsuk.github.io/civicproof-ledger/)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/leeminsuk/civicproof-ledger)](https://github.com/leeminsuk/civicproof-ledger/releases)

🇰🇷 한국어 안내: **[README.ko.md](README.ko.md)** · Live demo: **<https://leeminsuk.github.io/civicproof-ledger/>**

Commitment-based duplicate-benefit verification ledger for public grants, contests, scholarships, and vouchers. The demo keeps raw personal data off-chain and uses program-scoped nullifiers; full zero-knowledge proof integration is documented as a production roadmap item rather than claimed in this prototype.

## Three Verifiable Differentiators

1. **Replay-Verify Engine** (`src/replay.ts`) — anyone can re-derive the entire ledger state from the public audit-event log alone and compare deterministic state roots. Counter tampering, smuggled claims, commitment swaps, and forged duplicate events all surface as typed divergences. A Hardhat test replays real on-chain events back into the exact contract counters.
2. **Civic Integrity Index (cii-v1)** (`src/integrityIndex.ts`) — a deterministic 0-100 score (audit consistency 40, duplicate containment 30, credential integrity 20, privacy minimization 10). No model, no randomness: two independent auditors reproduce the identical number from public data.
3. **Red-Team Attack Corpus** (`src/attackCorpus.ts`, `npm run redteam`) — 12 executable attack scenarios across credential, ledger, proof, audit-log, and privacy categories. CI fails unless 100% are blocked, so any regression that weakens a defense breaks the build.

Since v1.0.0 a **property-based fuzz suite** (fast-check, `tests/property.fuzz.test.ts`) reinforces all three engines: hundreds of randomized ledger histories per run assert that replay always round-trips to a MATCH, every class of log/state tampering is detected, nullifiers never link across programs, and the integrity index stays deterministic and bounded.

## Contest-Ready Demo

This repository provides:

- Deterministic, program-scoped nullifier hashing with no raw personal data in the public identifier.
- An in-memory claim registry that accepts first claims, rejects duplicates, and exposes audit events plus summary stats.
- Demo Ed25519-signed verifiable credential issue and verify helpers using `@noble/ed25519` with RFC8785-compatible JSON canonicalization via `json-canonicalize`.
- A Merkle inclusion proof helper for nullifier audit reproducibility. This is intentionally labeled as an inclusion proof, not a zero-knowledge proof.
- A dependency-light Schnorr-style non-interactive proof demo (`src/zkProof.ts`) that proves knowledge of a nullifier secret without placing the subject secret in the proof object. Production should still replace this with audited Semaphore/Noir circuits.
- An interactive single-page demo under `web/` (civic dark dashboard, self-contained, GitHub Pages-ready) with four acts: an animated hero, a hands-on **ledger simulator** (click citizen × program to see accept/duplicate/cross-program-unlinkability live), an **attack theater** that runs all 12 red-team scenarios in the browser, and an **integrity dashboard** with a Civic Integrity Index gauge, Replay-Verify status, and a "tamper the audit log" toggle that drops the score in real time.
- A Solidity `ClaimRegistry` with owner-managed issuer allowlist, authorized issuer checks, ownership transfer for multisig/governance migration, program-level duplicate counters, and zero-value input validation.
- Hardhat tests for deployment, issuer role-based access control, ownership transfer, duplicate detection, program-level duplicate accounting, and read paths.
- A demo CLI scenario with two accepted claims and one duplicate rejection, ending with a Replay-Verify MATCH and a Civic Integrity Index of 100/100 EXCELLENT.
- A vendored `web/vendor/noble-ed25519.js` (MIT) so the GitHub Pages demo works without `node_modules` — the import map resolves inside the published site.
- A contest harness that checks tests, CI, SBOM, Pages workflow, safe web rendering, and final DOCX placeholder hygiene.
- A reusable `civicproof` CLI (`npm run cli`) that issues/verifies credentials and replays or scores **external** audit-log files, with ready-made fixtures under `examples/`.
- An open-source governance pack: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `NOTICE`, `CHANGELOG.md`, `CITATION.cff`, issue/PR templates (including a red-team attack-scenario template), SPDX headers on all first-party sources, and a Korean guide (`README.ko.md`).
- A local deployment script, `npm run deploy:local`, with a checked deployment artifact under `docs/deployments/`.

The credential proof type is `Ed25519Signature2020Demo`. It demonstrates canonical JSON signing and verification, not full production W3C VC compliance.

## Commands

```sh
npm ci
npm test
npm run coverage
npm run build
npm run test:contracts
npm run demo
npm run redteam
npm run deploy:local
npm run evaluate
npm audit
npm run sbom:check
```

For a machine-readable demo result:

```sh
npm run demo -- --json
```

Use the toolkit against your own files (fixtures live under `examples/`):

```sh
npm run cli -- issue --program osscontest-2026 --subject alice > credential.json
npm run cli -- verify credential.json
npm run cli -- replay examples/scenario-clean.json
npm run cli -- replay examples/scenario-tampered.json   # exit code 1: forged duplicate flagged
npm run cli -- cii examples/scenario-clean.json
```

To serve the static web verifier locally:

```sh
python3 -m http.server 4173 --directory web
```

Then open `http://127.0.0.1:4173/`. The repository also includes `.github/workflows/pages.yml` to publish `web/` with GitHub Pages.

## Submission Evidence

- CI (10 gates): GitHub Actions runs `npm test`, `npm run coverage`, `npm run build`, `npm run test:contracts`, `npm run demo`, `npm run redteam`, `npm run deploy:local`, `npm run evaluate`, `npm audit`, and `npm run sbom:check`.
- Contract hardening: only an authorized issuer can register a claim; the owner can authorize or revoke issuers.
- Privacy boundary: public state stores only program IDs, nullifier hashes, commitment hashes, metadata URIs, counters, and audit events. Raw identifiers stay off-chain.
- Final checklist: see [docs/final-submission-checklist.md](docs/final-submission-checklist.md).

More implementation notes are in [docs/architecture.md](docs/architecture.md), [docs/security.md](docs/security.md), and [docs/demo-script.md](docs/demo-script.md).

Community and governance: [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · [CHANGELOG.md](CHANGELOG.md) · [CITATION.cff](CITATION.cff)
