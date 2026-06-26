# Dependency License Compatibility Matrix

Team-authored code is licensed under Apache-2.0. The following matrix covers the runtime and judge-facing development dependencies used by the contest submission.

| Package / Tool | Role | License | Compatibility note |
|---|---|---|---|
| `@noble/ed25519` | Ed25519 VC signing and verification | MIT | Permissive, compatible with Apache-2.0 distribution. |
| `json-canonicalize` | RFC8785-compatible JSON canonicalization | MIT | Permissive, compatible with Apache-2.0 distribution. |
| `commander` | CLI option parsing | MIT | Permissive, compatible. |
| `typescript` | Compile/type checking | Apache-2.0 | Same permissive family as project license. |
| `tsx` | TypeScript script runner | MIT | Development/runtime helper, permissive. |
| `vitest` | Unit/integration testing | MIT | Development dependency, permissive. |
| `hardhat` | Local EVM and contract tests | MIT | Development/test dependency, permissive. |
| `@nomicfoundation/hardhat-ethers` | Contract deploy/call helper | MIT | Development/test dependency, permissive. |
| `@nomicfoundation/hardhat-mocha` | Contract test runner integration | MIT | Development/test dependency, permissive. |
| `mocha` / `chai` | Contract test assertions | MIT | Development/test dependency, permissive. |
| `solc` bundled by Hardhat | Solidity compilation | GPL-3.0-or-later for compiler, not linked into project code | Compiler tool license does not relicense team-authored Solidity source. |
| GitHub Actions | CI and Pages deployment | GitHub Terms | Hosted service, not redistributed code. |

## Audit result

`npm audit` returns 0 vulnerabilities after replacing the vulnerable Semaphore proof package experiment with a dependency-light in-repo Schnorr-style NIZK demo.

## Boundary statement

The contest prototype does not ship third-party model weights or closed AI runtime dependencies. Generated documents disclose AI-assisted planning/review, but project runtime data is not sent to an AI API.
