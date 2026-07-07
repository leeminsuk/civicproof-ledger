// SPDX-License-Identifier: Apache-2.0
// Fails (exit 1) when sbom.spdx.json no longer matches the dependency tree,
// so the published SBOM can never silently drift from package-lock.json.
// Comparison ignores volatile fields (timestamps, document namespace) and
// checks the (name, version, declared license) set of every package.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sbomPath = fileURLToPath(new URL('../sbom.spdx.json', import.meta.url));

const packageKey = (pkg) => `${pkg.name}@${pkg.versionInfo}|${pkg.licenseDeclared ?? 'NOASSERTION'}`;
const packageSet = (document) => new Set(document.packages.map(packageKey));

const committed = JSON.parse(readFileSync(sbomPath, 'utf8'));
const generated = JSON.parse(
  execFileSync('npm', ['sbom', '--sbom-format', 'spdx'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
);

const committedSet = packageSet(committed);
const generatedSet = packageSet(generated);
const missingFromSbom = [...generatedSet].filter((key) => !committedSet.has(key));
const staleInSbom = [...committedSet].filter((key) => !generatedSet.has(key));

if (missingFromSbom.length > 0 || staleInSbom.length > 0) {
  console.error('sbom.spdx.json has drifted from the dependency tree. Run: npm run sbom');
  if (missingFromSbom.length > 0) {
    console.error(`  missing from SBOM (${missingFromSbom.length}):`);
    for (const key of missingFromSbom.slice(0, 20)) console.error(`    + ${key}`);
  }
  if (staleInSbom.length > 0) {
    console.error(`  stale in SBOM (${staleInSbom.length}):`);
    for (const key of staleInSbom.slice(0, 20)) console.error(`    - ${key}`);
  }
  process.exit(1);
}

console.log(`SBOM OK: ${committedSet.size} unique packages match the current dependency tree.`);
