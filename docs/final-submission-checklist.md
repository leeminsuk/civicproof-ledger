# Final Submission Checklist

## Required Repository Evidence

- GitHub repository: `https://github.com/leeminsuk/civicproof-ledger` (public; keep public ≥ 5 years per contest rules)
- License: `LICENSE` — Apache-2.0, plus `NOTICE` and SPDX headers on all first-party sources
- SBOM: `sbom.spdx.json` (205 packages) — regenerate with `npm run sbom`, verified by `npm run sbom:check`
- CI: `.github/workflows/ci.yml` (10 gates)
- GitHub Pages: `.github/workflows/pages.yml` publishing `web/`
- Web demo: `web/index.html` → <https://leeminsuk.github.io/civicproof-ledger/>
- Contract: `contracts/ClaimRegistry.sol` + tests `tests/contracts/ClaimRegistry.test.js`
- Governance pack: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CHANGELOG.md`, `CITATION.cff`
- Final harness: `harness/evaluate_submission.py`

## Verification Commands

Run before submission:

```sh
npm ci
npm test               # 90 vitest tests incl. property fuzz + CLI suites
npm run coverage       # enforced thresholds
npm run build
npm run test:contracts # 20 hardhat tests
npm run demo | tee docs/demo-log.txt
npm run redteam        # must block 12/12
npm run deploy:local
npm run evaluate       # currently 340 (minimum 110)
npm audit              # 0 vulnerabilities
npm run sbom:check     # SBOM matches lockfile
python3 -m http.server 4173 --directory web
```

Expected quality gate:

- All 110 automated tests pass (Vitest 90 + Hardhat 20).
- Coverage thresholds met (statements/lines ≥ 85%, branches ≥ 72%).
- `npm run redteam` blocks 12/12 attacks; demo ends Replay MATCH + CII 100/100 EXCELLENT.
- `npm run evaluate` score is at least `110` (currently `340`).
- `npm audit` reports `0 vulnerabilities`; `npm run sbom:check` reports OK.
- Web UI opens at `http://127.0.0.1:4173/` and the four acts work (hero, simulator, attack theater, integrity dashboard).

## Final DOCX Files

- Repo copy: `docs/submission/2026_오픈소스개발자대회_결과보고서_CivicProof_최종.docx`
- Upload copies: `~/Downloads/2026 오픈소스 개발자대회 결과보고서_접수번호(CivicProof).docx` + PDF conversion of the same file
- 접수 폼 문구(프로젝트명·개발 목적 200자·소개 300자): `docs/submission/접수-프로젝트정보.txt`

## Manual Fields to Reconfirm Before Upload

- 접수번호: replace `접수번호` in the file name (and any body reference) with the issued number
- 팀명 `CivicProof` / 팀 인원 `1명` / 참가부문 `학생` / 과제유형 `자유과제` — must match the registration record
- 시연영상: shoot per `docs/submission/시연영상-촬영가이드.md`, upload to YouTube, paste the URL into the report
- PDF: re-export the DOCX on a machine with 맑은 고딕 installed (Windows/Word recommended) and confirm the body stays within 5 pages

## 3-Minute Video Assets

- Start with the problem statement (duplicate benefits vs. privacy).
- `npm run demo` — accepted 2 / duplicate 1 / Replay MATCH / CII 100.
- Live Pages demo: ledger simulator → attack theater (12/12) → tamper toggle (CII 100 → 60 → restore).
- `npm run cli -- replay examples/scenario-tampered.json` — exit 1 with the forged event flagged.
- `npm run test:contracts` issuer allowlist tests, then `npm run evaluate` 340/110.
- End on Apache-2.0 + SBOM + CI badges + governance docs.

## Submission Risk Notes

- `Ed25519Signature2020Demo` is a contest demo proof, not a full W3C VC production compliance claim.
- Production deployment should move owner control to a multisig/KMS-backed governance process.
- 중복수혜 확인서: 해당 없음(정부 지원사업 수혜 이력 없음) — submit only if the portal explicitly requires it.
