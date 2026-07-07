---
name: Attack scenario
about: Propose a new red-team scenario ("what if an attacker does X?")
title: "[ATK] "
labels: red-team
---

## Attacker capability

<!-- What can the attacker see or control? (e.g., can submit credentials,
     can publish forged audit events, controls a revoked issuer key…) -->

## Attack narrative

<!-- Step by step, what does the attacker do? -->

## Expected defense

<!-- Which mechanism should block this: signature verification, nullifier
     isolation, Replay-Verify divergence codes, registry validation…? -->

## Sketch (optional)

```ts
// pseudo-code for the scenario, following the ATK-XX shape in src/attackCorpus.ts
```

> If the attack actually **succeeds** against current code, do not post it here —
> report it privately via SECURITY.md first.
