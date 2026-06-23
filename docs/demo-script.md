# Demo Script

## Setup

```sh
npm ci
npm test
npm run build
npm run test:contracts
```

## CLI Demo

```sh
npm run demo
npm run demo -- --json
```

Expected story:

- First `osscontest-2026` credential verifies as normal and registers.
- Second `osscontest-2026` credential has a valid signature but the same program/nullifier, so it is a duplicate.
- `scholarship-2026` uses a separate program-scoped nullifier and registers normally.
- Public audit summary reports two accepted claims, one duplicate attempt, two programs, and zero PII fields.

## Contract Demo Talking Points

- Deployer starts as `owner` and authorized issuer.
- Owner can authorize or revoke agency writer keys with `authorizeIssuer(address,bool)`.
- Unauthorized accounts cannot write claims; `registerClaim` reverts with `UnauthorizedIssuer`.
- Invalid empty/zero claim material reverts with `InvalidInput`.
- Duplicate detection still records `DuplicateDetected` without replacing the original claim.

## Web Demo

Serve the static web verifier locally:

```sh
python3 -m http.server 4173 --directory web
```

Open `http://127.0.0.1:4173/`. Use **Load demo** to restore the sample credential, then **Verify credential** to classify pasted JSON as normal, duplicate, expired, or tampered.

For public judging, enable GitHub Pages for the repository. `.github/workflows/pages.yml` publishes the `web/` directory, so the demo URL becomes the repository’s Pages URL after the workflow succeeds.

## 3-Minute Video Flow

1. 0:00–0:25 — Problem: duplicate public-benefit claims require verification, but raw personal data should not be shared.
2. 0:25–0:55 — Architecture: signed VC, program-scoped nullifier, authorized issuer, EVM audit registry.
3. 0:55–1:35 — Run `npm run demo` and show two accepted claims, one duplicate, zero PII fields.
4. 1:35–2:20 — Open the web verifier and show normal/duplicate/tampered status.
5. 2:20–2:50 — Show `npm run test:contracts` and `npm run evaluate` outputs.
6. 2:50–3:00 — Close with Apache-2.0, SBOM, CI, and deployable GitHub Pages demo.
