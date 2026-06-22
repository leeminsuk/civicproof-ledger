# CivicProof Ledger

Privacy-preserving duplicate-benefit verification ledger for public grants, contests, scholarships, and vouchers.

## MVP

This MVP provides:

- Deterministic, program-scoped nullifier hashing with no raw personal data in the public identifier.
- An in-memory claim registry that accepts first claims, rejects duplicates, and exposes audit events plus summary stats.
- Unsigned demo verifiable credential issue and verify helpers.
- A demo CLI scenario with two accepted claims and one duplicate rejection.
- A simple Solidity `ClaimRegistry` contract for the same public registry model.

## Usage

```sh
npm test
npm run build
npm run demo
```

For a machine-readable demo result:

```sh
npm run demo -- --json
```

More implementation notes are in [docs/mvp.md](docs/mvp.md).
