#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
from __future__ import annotations

import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DOCX_VERIFY_FILES = [
    Path("/opt/data/osscontest_blockchain/2026_오픈소스개발자대회_결과보고서_CivicProof_Ledger_최종제출용.verify.txt"),
    Path("/opt/data/osscontest_blockchain/2026_오픈소스개발자대회_중복수혜확인서_CivicProof_Ledger_최종제출용.verify.txt"),
]


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


def final_docx_text_paths() -> list[Path]:
    env_value = os.environ.get("CIVICPROOF_DOCX_VERIFY_TEXTS", "")
    if env_value.strip():
        return [Path(part) for part in env_value.split(os.pathsep) if part]
    return DEFAULT_DOCX_VERIFY_FILES


def final_docx_has_no_blanks_when_available() -> bool:
    paths = [path for path in final_docx_text_paths() if path.exists()]
    if not paths:
        return True
    forbidden = [
        "[팀명 입력]",
        "[팀장 포함 N명 입력]",
        "[학생/일반 중 선택]",
        "[접수번호 입력]",
        "[3분 이내 유튜브 시연영상 URL 입력]",
        "[사용자 입력 필요]",
        "입력 예정",
        "촬영 후",
        "____",
    ]
    text = "\n".join(path.read_text(encoding="utf-8", errors="ignore") for path in paths)
    return all(token not in text for token in forbidden)


def spdx_headers_ok() -> bool:
    targets = (
        list((ROOT / "src").glob("*.ts"))
        + [ROOT / "web" / name for name in ["app.js", "hero.js", "demoEngine.js", "proofs.js", "verifier.js"]]
        + list((ROOT / "scripts").glob("*.mjs"))
        + list((ROOT / "scripts").glob("*.js"))
        + [
            ROOT / "harness" / "evaluate_submission.py",
            ROOT / "hardhat.config.js",
            ROOT / "vitest.config.ts",
            ROOT / "contracts" / "ClaimRegistry.sol",
        ]
    )
    return all(
        "SPDX-License-Identifier" in path.read_text(encoding="utf-8", errors="ignore")[:300]
        for path in targets
        if path.exists()
    )


def main() -> int:
    contract = read("contracts/ClaimRegistry.sol")
    docs_text = "\n".join(read(path) for path in ["README.md", "docs/architecture.md", "docs/security.md", "docs/demo-script.md", "docs/rubric-scorecard.md"] if exists(path))
    checks: list[tuple[str, int, bool]] = [
        ("Signed VC implementation uses @noble/ed25519", 12, "@noble/ed25519" in read("src/vc.ts")),
        ("VC signing uses RFC8785-compatible JSON canonicalization dependency", 8, "json-canonicalize" in read("package.json") and "canonicalize(" in read("src/vc.ts")),
        ("Unsigned demo proof removed from production source and docs", 10, "UnsignedDemoProof" not in production_text()),
        ("Vitest and contract test count >= 70", 12, count_tests() >= 70),
        ("Nullifier membership proof tests exist", 6, exists("src/nullifierProof.ts") and exists("tests/nullifierProof.test.ts")),
        ("Schnorr-style NIZK demo proof exists and is tested", 10, exists("src/zkProof.ts") and exists("tests/zkProof.test.ts") and "SchnorrNullifierNIZKDemo" in read("src/zkProof.ts")),
        ("Static verifier web UI exists", 10, all(exists(p) for p in ["web/index.html", "web/styles.css", "web/app.js", "web/verifier.js"])),
        ("Web UI avoids innerHTML rendering", 8, "innerHTML" not in read("web/app.js")),
        ("Hardhat contract tests exist", 10, exists("hardhat.config.js") and exists("tests/contracts/ClaimRegistry.test.js")),
        ("ClaimRegistry has owner-managed issuer allowlist", 12, all(token in contract for token in ["owner", "authorizedIssuers", "authorizeIssuer", "isAuthorizedIssuer", "UnauthorizedIssuer", "IssuerAuthorizationUpdated"])),
        ("ClaimRegistry validates zero hashes and empty metadata", 8, all(token in contract for token in ["InvalidInput", "programId == bytes32(0)", "nullifierHash == bytes32(0)", "commitmentHash == bytes32(0)", "bytes(metadataUri).length == 0"])),
        ("ClaimRegistry supports ownership transfer for governance/multisig migration", 8, all(token in contract for token in ["transferOwnership", "OwnershipTransferred", "newOwner == address(0)"])),
        ("ClaimRegistry exposes program-level duplicate counters", 8, "programDuplicateCounts" in contract and "programDuplicateCounts[programId] += 1" in contract),
        ("Local deployment script and artifact exist", 8, exists("scripts/deploy-claim-registry.js") and exists("docs/deployments/local-hardhat-claim-registry.json") and "deploy:local" in read("package.json")),
        ("Docs explain issuer allowlist/access control", 8, all(token.lower() in docs_text.lower() for token in ["issuer allowlist", "role-based access control", "authorized issuer"])),
        ("GitHub Pages workflow publishes web/", 8, exists(".github/workflows/pages.yml") and all(token in read(".github/workflows/pages.yml") for token in ["upload-pages-artifact", "deploy-pages", "path: web"])),
        ("SBOM exists", 8, exists("sbom.spdx.json")),
        ("CI workflow exists", 10, exists(".github/workflows/ci.yml")),
        ("CI runs required commands", 10, all(cmd in read(".github/workflows/ci.yml") for cmd in ["npm test", "npm run build", "npm run test:contracts", "npm run demo", "npm run deploy:local", "npm run evaluate", "npm audit"])),
        ("Contest documentation exists", 8, all(exists(p) for p in ["docs/demo-script.md", "docs/architecture.md", "docs/security.md", "docs/demo-log.txt", "docs/final-submission-checklist.md"])),
        ("README includes exact commands and web preview", 10, all(cmd in read("README.md") for cmd in ["npm test", "npm run build", "npm run test:contracts", "npm run demo", "npm run evaluate", "npm audit", "python3 -m http.server 4173 --directory web"])),
        ("Replay-Verify Engine exists and is tested", 10, exists("src/replay.ts") and exists("tests/replay.test.ts") and "verifyLedgerReplay" in read("src/replay.ts")),
        ("Civic Integrity Index (cii-v1) exists and is tested", 8, exists("src/integrityIndex.ts") and exists("tests/integrityIndex.test.ts") and "cii-v1" in read("src/integrityIndex.ts")),
        ("Red-Team Attack Corpus exists, is tested, and wired as npm run redteam", 10, exists("src/attackCorpus.ts") and exists("tests/attackCorpus.test.ts") and 'redteam' in read("package.json")),
        ("On-chain replay cross-check test exists", 6, "Replay-Verify" in read("tests/contracts/ClaimRegistry.test.js")),
        ("Web verifier ships a vendored signature module (GitHub Pages safe)", 6, exists("web/vendor/noble-ed25519.js") and "./vendor/noble-ed25519.js" in read("web/index.html")),
        ("CI runs the red-team corpus", 4, "npm run redteam" in read(".github/workflows/ci.yml")),
        ("Interactive ledger simulator exists and is tested", 8, exists("web/demoEngine.js") and exists("tests/demoEngine.test.ts") and "createSimulator" in read("web/demoEngine.js")),
        ("Browser proof mirrors (Schnorr + Merkle) exist and are tested", 6, exists("web/proofs.js") and exists("tests/proofs.test.ts") and "SchnorrNullifierNIZKDemo" in read("web/proofs.js")),
        ("Interactive demo has hero canvas, attack theater, and tamper toggle", 6, all(token in read("web/index.html") for token in ["hero-canvas", "run-attacks", "tamper-switch", "play-scenario"])),
        ("Browser attack corpus and Node corpus both cover 12 scenarios", 6, "ATK-12" in read("web/demoEngine.js") and "ATK-12" in read("src/attackCorpus.ts")),
        ("Final DOCX verification text has no blank placeholders when available", 6, final_docx_has_no_blanks_when_available()),
        ("Open-source governance pack exists (CONTRIBUTING/CoC/SECURITY/NOTICE/CHANGELOG/CITATION)", 10, all(exists(p) for p in ["CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "SECURITY.md", "NOTICE", "CHANGELOG.md", "CITATION.cff"])),
        ("Issue and PR templates exist (including red-team attack-scenario template)", 4, all(exists(p) for p in [".github/ISSUE_TEMPLATE/bug_report.md", ".github/ISSUE_TEMPLATE/feature_request.md", ".github/ISSUE_TEMPLATE/attack_scenario.md", ".github/PULL_REQUEST_TEMPLATE.md"])),
        ("Korean README exists and links the live demo", 6, exists("README.ko.md") and "leeminsuk.github.io/civicproof-ledger" in read("README.ko.md")),
        ("First-party sources carry SPDX Apache-2.0 headers", 8, spdx_headers_ok()),
        ("Property-based fuzz suite exists with fast-check", 10, exists("tests/property.fuzz.test.ts") and "fast-check" in read("package.json") and len(re.findall(r"\bit\(", read("tests/property.fuzz.test.ts"))) >= 8),
        ("Coverage gate has thresholds and runs in CI", 8, '"coverage"' in read("package.json") and "thresholds" in read("vitest.config.ts") and "npm run coverage" in read(".github/workflows/ci.yml")),
        ("SBOM is regenerable and freshness-checked in CI", 8, exists("scripts/check-sbom.mjs") and '"sbom"' in read("package.json") and "npm run sbom:check" in read(".github/workflows/ci.yml")),
        ("Reusable CLI exists, is tested, and documented", 8, exists("src/cli.ts") and exists("tests/cli.test.ts") and '"cli"' in read("package.json") and "npm run cli" in read("README.md")),
        ("Example scenario fixtures exist and are referenced", 4, exists("examples/scenario-clean.json") and exists("examples/scenario-tampered.json") and "examples/scenario-clean.json" in read("README.md")),
        ("Version 1.0.0 released with changelog entry", 4, '"version": "1.0.0"' in read("package.json") and "## [1.0.0]" in read("CHANGELOG.md")),
        ("Node runtime pinned (engines + .nvmrc)", 2, exists(".nvmrc") and '"node"' in read("package.json")),
    ]

    score = sum(points for _, points, passed in checks if passed)
    report = {
        "score": score,
        "targetScore": 110,
        "testCount": count_tests(),
        "checks": [
            {"name": name, "points": points, "passed": passed}
            for name, points, passed in checks
        ],
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if score >= 110 else 1


if __name__ == "__main__":
    raise SystemExit(main())
