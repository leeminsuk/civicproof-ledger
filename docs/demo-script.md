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

## Web Demo

Serve the repository root so the import map can load `node_modules`:

```sh
npx http-server . -p 8080
```

Open `http://127.0.0.1:8080/web/`. Use **Load demo** to restore the sample credential, then **Verify credential** to classify pasted JSON as normal, duplicate, expired, or tampered.
