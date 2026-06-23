# CivicProof Ledger

Privacy-preserving duplicate-benefit verification ledger for public grants, contests, scholarships, and vouchers.

## Contest-Ready Demo

This repository provides:

- Deterministic, program-scoped nullifier hashing with no raw personal data in the public identifier.
- An in-memory claim registry that accepts first claims, rejects duplicates, and exposes audit events plus summary stats.
- Demo Ed25519-signed verifiable credential issue and verify helpers using `@noble/ed25519`.
- A static verifier and public audit UI under `web/`.
- Hardhat tests for the Solidity `ClaimRegistry` contract.
- A demo CLI scenario with two accepted claims and one duplicate rejection.
- A simple Solidity `ClaimRegistry` contract for the same public registry model.

The credential proof type is `Ed25519Signature2020Demo`. It demonstrates canonical JSON signing and verification, not full production W3C VC compliance.

## Commands

```sh
npm ci
npm test
npm run build
npm run test:contracts
npm run demo
npm run evaluate
npm audit
```

For a machine-readable demo result:

```sh
npm run demo -- --json
```

To serve the static web verifier locally:

```sh
npx http-server . -p 8080
```

Then open `http://127.0.0.1:8080/web/`.

More implementation notes are in [docs/architecture.md](docs/architecture.md), [docs/security.md](docs/security.md), and [docs/demo-script.md](docs/demo-script.md).
