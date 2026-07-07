# Contributing to CivicProof Ledger

Thanks for your interest! This project treats **verifiability as the product**: every claim in the docs must be reproducible by a command in the repo. Contributions are held to the same bar.

한국어 사용자는 [README.ko.md](README.ko.md)의 개요를 먼저 읽어 주세요. 이슈·PR은 한국어/영어 모두 환영합니다.

## Development Setup

```sh
nvm use            # Node 22 (.nvmrc)
npm ci
npm test           # Vitest unit/integration suite (includes the fuzz suite)
npm run build      # strict TypeScript build
npm run test:contracts
```

## Quality Gates (all must pass before a PR is merged)

| Gate | Command | What it protects |
|------|---------|------------------|
| Unit + property fuzzing | `npm test` | invariants: replay round-trip, tamper detection, nullifier isolation |
| Coverage thresholds | `npm run coverage` | untested first-party code cannot land |
| Type integrity | `npm run build` | strict TS across src and tests |
| Contract behavior | `npm run test:contracts` | issuer RBAC, duplicate counters, event shape |
| End-to-end demo | `npm run demo` | the vertical slice stays connected |
| Red-team corpus | `npm run redteam` | 12/12 attacks must stay blocked |
| Local deployment | `npm run deploy:local` | contract deploys from a clean tree |
| Self-evaluation harness | `npm run evaluate` | docs/claims vs. code drift |
| Dependency audit | `npm audit` | zero known vulnerabilities |
| SBOM freshness | `npm run sbom:check` | `sbom.spdx.json` matches the lockfile |

## Branch and PR Flow

1. Branch from `develop`: `feature/<short-topic>`.
2. Open a PR into `develop`; CI must be green. Fill in the PR template checklist honestly.
3. `develop` → `main` merges are release merges (tagged, changelog updated).

## Contributing a New Attack Scenario (most wanted!)

The Red-Team Attack Corpus (`src/attackCorpus.ts`) encodes judge/auditor questions of the form *"what if an attacker does X?"* as executable scenarios. To add one:

1. Open an issue with the **Attack scenario** template describing the attacker capability and expected defense.
2. Add `ATK-13` (next id) to `src/attackCorpus.ts` following the existing result shape (`blocked` must be derived from observed behavior, never hard-coded).
3. Mirror it in the browser corpus (`web/demoEngine.js`) so the Attack Theater stays in sync.
4. Add or extend tests in `tests/attackCorpus.test.ts`. CI fails unless 100% of scenarios are blocked — if your attack leaks, congratulations: file it via `SECURITY.md` instead and we will fix the defense first.

## Style

- TypeScript strict mode; no `any` unless quarantined with a comment.
- Determinism first: scoring/verdict logic must be reproducible from public data — no randomness, no wall-clock dependence outside explicitly passed timestamps.
- Web code renders untrusted strings with `textContent`/`createElement` only (no `innerHTML`).
- Keep SPDX headers (`// SPDX-License-Identifier: Apache-2.0`) on all first-party source files.

## Developer Certificate of Origin

By contributing you certify the [DCO 1.1](https://developercertificate.org/). Please sign off your commits (`git commit -s`).

## License

Contributions are accepted under [Apache-2.0](LICENSE). Third-party code must be OSI-licensed and disclosed in `docs/licenses.md` + the SBOM.
