# Final Submission Checklist

## Required Repository Evidence

- GitHub repository: `https://github.com/leeminsuk/civicproof-ledger`
- License: `LICENSE` — Apache-2.0
- SBOM: `sbom.spdx.json`
- CI: `.github/workflows/ci.yml`
- GitHub Pages: `.github/workflows/pages.yml` publishing `web/`
- Web demo: `web/index.html`
- Contract: `contracts/ClaimRegistry.sol`
- Contract tests: `tests/contracts/ClaimRegistry.test.js`
- Final harness: `harness/evaluate_submission.py`

## Verification Commands

Run before submission:

```sh
npm ci
npm test
npm run build
npm run test:contracts
npm run demo | tee docs/demo-log.txt
npm run evaluate
npm audit
python3 -m http.server 4173 --directory web
```

Expected quality gate:

- Vitest passes.
- Hardhat contract tests pass, including issuer allowlist and invalid-input checks.
- `npm run evaluate` score is at least `110`.
- `npm audit` reports `0 vulnerabilities`.
- Web UI opens at `http://127.0.0.1:4173/` and verifies normal/duplicate/tampered examples.

## Final DOCX Files

- `/opt/data/osscontest_blockchain/2026_오픈소스개발자대회_결과보고서_CivicProof_Ledger_최종제출용.docx`
- `/opt/data/osscontest_blockchain/2026_오픈소스개발자대회_중복수혜확인서_CivicProof_Ledger_최종제출용.docx`

## Manual Fields to Reconfirm Before Upload

The current documents are filled so there are no blank cells, but the organizer/user should still replace administrative values if they differ:

- Team name: `CivicProof Team`
- Team size: `1명`
- Participant division: `일반`
- Receipt number: `접수 후 발급번호 입력 예정`
- Demonstration video URL: `시연영상 촬영 후 URL 입력 예정`
- Representative/signature date: `2026-06-23`

## 3-Minute Video Assets

- Start with README problem statement.
- Run `npm run demo`.
- Show `web/index.html` served via `python3 -m http.server 4173 --directory web`.
- Show `npm run test:contracts` issuer allowlist tests.
- Show `npm run evaluate` score.
- End on GitHub repository, Apache-2.0, SBOM, CI, and Pages workflow.

## Submission Risk Notes

- `Ed25519Signature2020Demo` is a contest demo proof, not a full W3C VC production compliance claim.
- Production deployment should move owner control to a multisig/KMS-backed governance process.
- If the official portal generates a receipt number or requires a real YouTube URL, replace the current non-blank administrative text before final upload.
