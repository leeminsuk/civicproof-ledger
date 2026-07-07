# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-07

### Added
- Reusable `civicproof` CLI (`npm run cli`) with `issue`, `verify`, `replay`, `cii`, `demo`, and `redteam` subcommands, so the ledger toolkit can be used against external event/credential files, not only the built-in demo.
- Property-based fuzz suite (`tests/property.fuzz.test.ts`, fast-check): hundreds of randomized cases assert the replay round-trip invariant, guaranteed tamper detection, nullifier program isolation, VC sign/verify integrity, Schnorr and Merkle proof soundness, and Civic Integrity Index determinism/bounds.
- Coverage gate: `npm run coverage` (V8 provider) with enforced thresholds, wired into CI.
- SBOM automation: `npm run sbom` regenerates `sbom.spdx.json` from the lockfile and `npm run sbom:check` fails CI when the SBOM drifts from the dependency tree.
- Open-source governance pack: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md`, `NOTICE`, `CITATION.cff`, issue templates (including a red-team attack-scenario template), and a pull-request template with the full verification checklist.
- Korean project guide `README.ko.md` for Korean-speaking users and reviewers.
- Example scenario fixtures under `examples/` (clean and tampered audit logs) used by both the CLI docs and the test suite.
- SPDX `Apache-2.0` license headers across all first-party source files.

### Changed
- Version bumped to 1.0.0; `package.json` now declares `engines.node >= 22`, repository metadata, and keywords.
- CI extended from 8 to 10 gates (coverage threshold gate and SBOM freshness gate).

## [0.1.0] - 2026-07-03

### Added
- Program-scoped nullifier hashing, in-memory claim registry, and audit-event log (`src/ledger.ts`).
- Ed25519 verifiable-credential issue/verify helpers with RFC 8785-compatible canonical JSON signing (`src/vc.ts`).
- Solidity `ClaimRegistry` with owner-managed issuer allowlist, duplicate counters, and ownership transfer (`contracts/ClaimRegistry.sol`) plus Hardhat tests.
- Replay-Verify Engine (`src/replay.ts`): rebuilds the full ledger state from public audit events and compares deterministic state roots.
- Civic Integrity Index `cii-v1` (`src/integrityIndex.ts`): deterministic 0-100 score with fixed weights.
- Red-Team Attack Corpus (`src/attackCorpus.ts`): 12 executable attack scenarios; CI fails unless 12/12 are blocked.
- Four-act interactive web demo (hero, ledger simulator, attack theater, integrity dashboard) published via GitHub Pages.
- Schnorr-style NIZK demo, Merkle inclusion proofs, local deployment script, SPDX SBOM, evaluation harness, and CI pipeline.
