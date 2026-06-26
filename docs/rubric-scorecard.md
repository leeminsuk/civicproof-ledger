# CivicProof Ledger — Harsh Rubric Scorecard

This file separates deterministic readiness from judge competitiveness. It is not an official contest score.

## Current Readiness Evidence

| Gate | Evidence | Status |
|---|---|---|
| Tests | Vitest 29 + Hardhat 19 | Pass |
| Build | `npm run build` | Pass |
| Local deploy | `npm run deploy:local` + `docs/deployments/local-hardhat-claim-registry.json` | Pass |
| Demo | `npm run demo` accepted 2 / duplicate 1 / PII 0 | Pass |
| Harness | `npm run evaluate` 198/110 | Pass |
| Audit | `npm audit` | 0 vulnerabilities |
| Report density | 17 DOCX partitions, min partition chars 1624 | Pass |

## Official-Rubric-Oriented Target

| Rubric | Max | Current evidence | Remaining risk | Target score |
|---|---:|---|---|---:|
| Problem / Creativity | 20 | Public-benefit duplicate-prevention + privacy-minimizing ledger | Similarity to existing nullifier patterns | 18 |
| Technical Implementation | 30 | Ed25519 VC, RFC8785-compatible canonicalization, Schnorr-style NIZK demo, RBAC, ownership transfer, program counters, tests | Audited Semaphore/Noir circuit not yet shipped | 27 |
| Completeness / Demo | 20 | Pages UI, CLI demo, local deploy artifact, dense DOCX | Public testnet and YouTube URL require user/funds | 17 |
| Open Source / License | 15 | Apache-2.0, SBOM, CI, license matrix, npm audit 0 | Formal legal review not included | 14 |
| Impact / Expansion | 15 | Public-sector scenarios, KMS/multisig/ZK roadmap, adoption matrix | No real institution pilot | 12 |
| **Estimated competitive score after this hardening** | **100** |  |  | **88** |

## Path to 95+

These are the remaining evidence items most likely to move the harsh estimate above 95:

1. Public testnet deployment: Sepolia or Polygon Amoy contract address + 3 block explorer links.
2. Real ZK proof path: Semaphore/Noir/snarkjs proof generation and verification log, or a narrow in-repo proof circuit with reproducible artifacts.
3. Actual 3-minute YouTube demo URL in the official DOCX if the portal requires video rather than a Pages URL.
4. One external adopter/interview note or mock integration with a grant/scholarship workflow API.

The repository is prepared for these, but they require either external funds/accounts or a larger ZK artifact set. Do not claim them as completed until the evidence exists.
