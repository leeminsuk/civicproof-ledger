# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-08-19

### Added
- **160-second autopilot demo** (`web/autopilot.js` + driver in `web/app.js`): one click walks all four acts hands-free. Broadcast-style subtitle captions narrate what is running, its role, and what comes next (coming-up preview); a segmented control-room HUD tracks act progress and elapsed time; spotlight rings highlight the evidence (privacy KPI, ledger entries, nullifier comparison, replay card, state root); achievement chips mark milestones; a finale card summarizes the live run stats. ESC or the HUD button stops and cleans up at any point.
- Autopilot timeline is **declarative, validated data**: `validateTimeline()` enforces ordering, the exact 160 000 ms end, one-to-one sync with the scripted scenario, full 12-attack coverage, tamper inject-before-recover, and minimum narration density per act. The executor takes an injectable clock and a `speed` factor (`?apspeed=N` browser hook).
- 19 new Vitest cases (`tests/autopilot.test.ts`): timeline invariants, validator rejection paths, and a virtual-clock executor suite (ordering, speed compression, stop/cleanup semantics, sync/async error resilience, double-start guard, coming-up preview traversal).
- Playwright E2E gate `npm run e2e` (`scripts/e2e-autopilot.mjs`): serves `web/`, runs the full autopilot at 20x, and fails on any console/page error or if the run does not end at 12/12 blocked, CII 100 EXCELLENT, Replay MATCH. Uses `playwright-core` against the shared ms-playwright browser cache (no download; cached-executable fallback included). Kept out of the 10 CI gates so CI stays browser-free.
- One-take contest video recorder `npm run record:video`: records the real-time 160 s autopilot run at 1920x1080 (webm, plus mp4 when a system ffmpeg exists).
- Autopilot screenshots under `docs/assets/` (`autopilot-start.png`, `autopilot-attacks.png`, `autopilot-finale.png`).

### Changed
- `web/app.js` `submit()` now returns the submission result (the autopilot driver consumes it); the tamper one-shot logic is factored into reusable `setTamperVisual()`/`applyTamperView()`.
- Coverage configuration includes `web/autopilot.js`; the shooting guide (`docs/submission/시연영상-촬영가이드.md`) is rewritten around the one-take autopilot recording.

### Security
- `npm audit fix` clears 7 advisories published after v1.0.0 (postcss <=8.5.22: GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849; undici <=6.27.0: GHSA-8xcm-r25x-g524, GHSA-m8rv-5g2x-5cg5, GHSA-v3r7-h72x-cjcm) — back to 0 vulnerabilities, SBOM regenerated and freshness-checked.

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
