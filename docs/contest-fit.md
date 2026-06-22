# 2026 OSS Contest Fit

CivicProof Ledger is positioned for the 2026 Open Source Developer Contest free-project track.

## Official requirement mapping

| Requirement / judge concern | CivicProof response |
| --- | --- |
| Free project includes blockchain/security/social-problem domains | Uses blockchain audit logs for duplicate-benefit prevention and privacy-preserving public support verification. |
| Open source repository required | Apache-2.0 source code in this public GitHub repository. |
| Functional test in round 2 | `npm test`, `npm run build`, and `npm run demo` reproduce the MVP scenario. |
| License verification | SPDX SBOM is generated in `sbom.spdx.json`; CI runs `npm audit --omit=dev`. |
| AI model disclosure | No runtime AI model is embedded in the MVP, so open-weight model requirements do not apply to runtime behavior. |
| 3-minute demo | Demo story: first claim accepted, duplicate blocked, same subject allowed in a different program, public audit shows 0 PII fields. |

## MVP scope

The first implementation intentionally uses hash/nullifier privacy instead of full ZK proofs so that the contest submission has a reliable runnable artifact. The roadmap is to add Semaphore/Noir-based proof generation after the base registry and UI are stable.
