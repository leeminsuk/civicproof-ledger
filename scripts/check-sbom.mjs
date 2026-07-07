// SPDX-License-Identifier: Apache-2.0
// SBOM freshness gate: fails (exit 1) when sbom.spdx.json no longer matches the
// locked dependency tree, so the published SBOM can never silently drift from
// package-lock.json.
//
// The check compares the committed SBOM against package-lock.json (both are
// committed and deterministic) rather than against a freshly generated SBOM.
// A freshly generated SBOM reflects the *installed* node_modules, which includes
// only the current platform's optional native binaries (e.g. @esbuild/darwin-arm64
// on macOS vs. @esbuild/linux-x64 in CI). Comparing against the lockfile — and
// excluding optional/platform-specific packages from both sides — makes the gate
// platform- and npm-version-independent while still catching real dependency drift.
import { readFileSync } from 'node:fs';

const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const sbom = JSON.parse(readFileSync(new URL('../sbom.spdx.json', import.meta.url), 'utf8'));

function nameFromLockPath(path) {
  const marker = 'node_modules/';
  const index = path.lastIndexOf(marker);
  return index === -1 ? null : path.slice(index + marker.length);
}

// Package names that are optional or OS/CPU-specific. These legitimately differ
// between the machine that generated the SBOM and any other machine, so they are
// excluded from both sides of the comparison.
// Prefer the lockfile's own `name` field: npm aliases (e.g. "string-width-cjs")
// carry the real package name there ("string-width"), which is what npm sbom emits.
const lockName = (path, meta) => (path === '' ? lock.name : meta.name ?? nameFromLockPath(path));

// Native prebuilt binaries are published as one package per OS/arch (e.g.
// @esbuild/linux-x64, @rollup/rollup-darwin-arm64, @nomicfoundation/edr-win32-x64-msvc).
// Only the current platform's binary is installed, so the SBOM lists a different one
// than another machine would. Some carry os/cpu markers in the lockfile, some (edr)
// do not, so we also match them by name.
const PLATFORM_BINARY = /(?:^|[/-])(?:darwin|linux|win32|freebsd|openbsd|netbsd|android|sunos|aix)(?:[/-]|$)/;
const isVolatile = (name, meta) =>
  !name ||
  Boolean(meta?.optional || meta?.os || meta?.cpu || meta?.devOptional) ||
  PLATFORM_BINARY.test(name);

const volatileNames = new Set();
for (const [path, meta] of Object.entries(lock.packages ?? {})) {
  const name = lockName(path, meta);
  if (name && isVolatile(name, meta)) {
    volatileNames.add(name);
  }
}

const expected = new Set();
for (const [path, meta] of Object.entries(lock.packages ?? {})) {
  if (path === '') continue; // the root package itself
  const name = lockName(path, meta);
  if (!name || !meta.version || meta.link) continue;
  if (volatileNames.has(name)) continue;
  expected.add(`${name}@${meta.version}`);
}

const actual = new Set();
for (const pkg of sbom.packages ?? []) {
  if (pkg.name === lock.name && pkg.versionInfo === lock.version) continue; // root
  if (!pkg.name || !pkg.versionInfo) continue;
  if (volatileNames.has(pkg.name)) continue;
  actual.add(`${pkg.name}@${pkg.versionInfo}`);
}

const missingFromSbom = [...expected].filter((key) => !actual.has(key));
const staleInSbom = [...actual].filter((key) => !expected.has(key));

if (missingFromSbom.length > 0 || staleInSbom.length > 0) {
  console.error('sbom.spdx.json has drifted from package-lock.json. Run: npm run sbom');
  if (missingFromSbom.length > 0) {
    console.error(`  in lockfile but missing from SBOM (${missingFromSbom.length}):`);
    for (const key of missingFromSbom.slice(0, 20)) console.error(`    + ${key}`);
  }
  if (staleInSbom.length > 0) {
    console.error(`  in SBOM but not in lockfile (${staleInSbom.length}):`);
    for (const key of staleInSbom.slice(0, 20)) console.error(`    - ${key}`);
  }
  process.exit(1);
}

console.log(
  `SBOM OK: ${expected.size} platform-independent packages match package-lock.json ` +
    `(${volatileNames.size} optional/platform-specific packages ignored).`
);
