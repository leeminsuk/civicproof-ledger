# Summary

<!-- What does this PR change, and why? Link the issue if one exists. -->

## Verification Checklist

- [ ] `npm test` passes (unit + property fuzz suite)
- [ ] `npm run coverage` meets thresholds
- [ ] `npm run build` passes (strict TypeScript)
- [ ] `npm run test:contracts` passes
- [ ] `npm run demo` ends with Replay-Verify MATCH and CII 100/100
- [ ] `npm run redteam` blocks 12/12 attacks
- [ ] `npm run evaluate` passes (docs/claims vs. code drift)
- [ ] `npm run sbom:check` passes (SBOM matches lockfile; run `npm run sbom` if deps changed)
- [ ] New/changed first-party files carry SPDX `Apache-2.0` headers
- [ ] CHANGELOG.md updated for user-visible changes

## Security Considerations

<!-- Does this touch verification, hashing, signing, or the privacy boundary?
     If yes, state which red-team scenarios cover it or add a new ATK. -->
