# CivicProof Ledger — Harsh Rubric Scorecard

This file separates deterministic readiness from judge competitiveness. It is not an official contest score. Last refreshed for v1.1.0 (2026-08-19).

## Current Readiness Evidence

| Gate | Evidence | Status |
|---|---|---|
| Tests | Vitest 111 (incl. property fuzz, CLI, and autopilot suites) + Hardhat 20 = 131 | Pass |
| Coverage | `npm run coverage` — v8 provider, enforced thresholds (stmts/lines ≥ 85, branches ≥ 72) | Pass |
| Build | `npm run build` (strict TypeScript) | Pass |
| Local deploy | `npm run deploy:local` + `docs/deployments/local-hardhat-claim-registry.json` | Pass |
| Demo | `npm run demo` accepted 2 / duplicate 1 / PII 0 / Replay MATCH / CII 100 | Pass |
| Red team | `npm run redteam` blocked 12/12 | Pass |
| Harness | `npm run evaluate` 392/110 | Pass |
| Audit | `npm audit` | 0 vulnerabilities |
| SBOM | `npm run sbom:check` — platform-independent package set matches the lockfile (210 SBOM entries) | Pass |
| Browser E2E | `npm run e2e` — full 160s autopilot run, 0 console errors, 12/12 blocked, CII 100, Replay MATCH | Pass |
| Governance | CONTRIBUTING · CoC 2.1 · SECURITY · NOTICE · CHANGELOG · CITATION · templates · SPDX headers | Shipped |

## Official-Rubric-Oriented Target

| Rubric | Max | Current evidence | Remaining risk | Target score |
|---|---:|---|---|---:|
| Problem / Creativity | 20 | Public-benefit duplicate-prevention + privacy-minimizing ledger; social-problem framing | Similarity to existing nullifier patterns | 18 |
| Technical Implementation | 30 | Ed25519 VC, RFC8785 canonicalization, Schnorr NIZK demo, RBAC, replay engine, property-based fuzzing | Audited Semaphore/Noir circuit not yet shipped | 28 |
| Completeness / Demo | 20 | 4-act Pages UI + 160s autopilot demo with subtitle narration, one-take video recorded by code, reusable CLI, 131 tests, coverage gate, local deploy artifact | Public testnet requires funds; YouTube upload pending | 19 |
| Open Source / License | 15 | Apache-2.0 + SPDX headers everywhere, SBOM regenerable + CI-checked, full governance pack, Korean README | — | 15 |
| Impact / Expansion | 15 | Public-sector scenarios, CLI reuse for external audit logs, KMS/multisig/ZK roadmap | No real institution pilot | 13 |
| **Estimated competitive score after v1.1.0 hardening** | **100** |  |  | **93** |

## Path to 95+

Remaining evidence items most likely to move the harsh estimate above 95:

1. Public testnet deployment: Sepolia or Polygon Amoy contract address + block explorer links.
2. Real ZK proof path: Semaphore/Noir/snarkjs proof generation and verification log with reproducible artifacts.
3. Actual 3-minute YouTube demo URL in the official DOCX (shot list: `docs/submission/시연영상-촬영가이드.md`).
4. One external adopter/interview note or mock integration with a grant/scholarship workflow API.

The repository is prepared for these, but they require external funds/accounts or a larger ZK artifact set. Do not claim them as completed until the evidence exists.
