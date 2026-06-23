#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def exists(path: str) -> bool:
    return (ROOT / path).exists()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def count_tests() -> int:
    total = 0
    for path in list((ROOT / "tests").glob("**/*.test.ts")) + list((ROOT / "tests").glob("**/*.test.js")):
        total += len(re.findall(r"\bit\s*\(", path.read_text(encoding="utf-8")))
    return total


def production_text() -> str:
    """Return production/docs text only; exclude tests and this harness so negative checks are meaningful."""
    ignored_parts = {"node_modules", ".git", "tests", "harness", "dist", "cache", "artifacts"}
    chunks: list[str] = []
    for path in ROOT.glob("**/*"):
        if not path.is_file() or any(part in ignored_parts for part in path.parts):
            continue
        if path.suffix.lower() in {".ts", ".js", ".md", ".html", ".css", ".json", ".sol", ".yml", ".yaml"}:
            chunks.append(path.read_text(encoding="utf-8", errors="ignore"))
    return "\n".join(chunks)


def main() -> int:
    checks: list[tuple[str, int, bool]] = [
        ("Signed VC implementation uses @noble/ed25519", 12, "@noble/ed25519" in read("src/vc.ts")),
        ("Unsigned demo proof removed from production source and docs", 10, "UnsignedDemoProof" not in production_text()),
        ("Vitest and contract test count >= 24", 12, count_tests() >= 24),
        ("Static verifier web UI exists", 10, all(exists(p) for p in ["web/index.html", "web/styles.css", "web/app.js", "web/verifier.js"])),
        ("Hardhat contract tests exist", 10, exists("hardhat.config.js") and exists("tests/contracts/ClaimRegistry.test.js")),
        ("SBOM exists", 8, exists("sbom.spdx.json")),
        ("CI workflow exists", 10, exists(".github/workflows/ci.yml")),
        ("CI runs required commands", 10, all(cmd in read(".github/workflows/ci.yml") for cmd in ["npm test", "npm run build", "npm run test:contracts", "npm run demo", "npm run evaluate", "npm audit"])),
        ("Contest documentation exists", 8, all(exists(p) for p in ["docs/demo-script.md", "docs/architecture.md", "docs/security.md", "docs/demo-log.txt"])),
        ("README includes exact commands", 10, all(cmd in read("README.md") for cmd in ["npm test", "npm run build", "npm run test:contracts", "npm run demo", "npm run evaluate", "npm audit"])),
    ]

    score = sum(points for _, points, passed in checks if passed)
    report = {
        "score": score,
        "targetScore": 95,
        "testCount": count_tests(),
        "checks": [
            {"name": name, "points": points, "passed": passed}
            for name, points, passed in checks
        ],
    }
    print(json.dumps(report, indent=2))
    return 0 if score >= 95 else 1


if __name__ == "__main__":
    raise SystemExit(main())
