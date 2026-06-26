#!/usr/bin/env python3
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


def main() -> int:
    contract = read("contracts/ClaimRegistry.sol")
    docs_text = "\n".join(read(path) for path in ["README.md", "docs/architecture.md", "docs/security.md", "docs/demo-script.md"] if exists(path))
    checks: list[tuple[str, int, bool]] = [
        ("Signed VC implementation uses @noble/ed25519", 12, "@noble/ed25519" in read("src/vc.ts")),
        ("Unsigned demo proof removed from production source and docs", 10, "UnsignedDemoProof" not in production_text()),
        ("Vitest and contract test count >= 30", 12, count_tests() >= 30),
        ("Static verifier web UI exists", 10, all(exists(p) for p in ["web/index.html", "web/styles.css", "web/app.js", "web/verifier.js"])),
        ("Web UI avoids innerHTML rendering", 8, "innerHTML" not in read("web/app.js")),
        ("Hardhat contract tests exist", 10, exists("hardhat.config.js") and exists("tests/contracts/ClaimRegistry.test.js")),
        ("ClaimRegistry has owner-managed issuer allowlist", 12, all(token in contract for token in ["owner", "authorizedIssuers", "authorizeIssuer", "isAuthorizedIssuer", "UnauthorizedIssuer", "IssuerAuthorizationUpdated"])),
        ("ClaimRegistry validates zero hashes and empty metadata", 8, all(token in contract for token in ["InvalidInput", "programId == bytes32(0)", "nullifierHash == bytes32(0)", "commitmentHash == bytes32(0)", "bytes(metadataUri).length == 0"])),
        ("ClaimRegistry supports ownership transfer for governance/multisig migration", 8, all(token in contract for token in ["transferOwnership", "OwnershipTransferred", "newOwner == address(0)"])),
        ("ClaimRegistry exposes program-level duplicate counters", 8, "programDuplicateCounts" in contract and "programDuplicateCounts[programId] += 1" in contract),
        ("Docs explain issuer allowlist/access control", 8, all(token.lower() in docs_text.lower() for token in ["issuer allowlist", "role-based access control", "authorized issuer"])),
        ("GitHub Pages workflow publishes web/", 8, exists(".github/workflows/pages.yml") and all(token in read(".github/workflows/pages.yml") for token in ["upload-pages-artifact", "deploy-pages", "path: web"])),
        ("SBOM exists", 8, exists("sbom.spdx.json")),
        ("CI workflow exists", 10, exists(".github/workflows/ci.yml")),
        ("CI runs required commands", 10, all(cmd in read(".github/workflows/ci.yml") for cmd in ["npm test", "npm run build", "npm run test:contracts", "npm run demo", "npm run evaluate", "npm audit"])),
        ("Contest documentation exists", 8, all(exists(p) for p in ["docs/demo-script.md", "docs/architecture.md", "docs/security.md", "docs/demo-log.txt", "docs/final-submission-checklist.md"])),
        ("README includes exact commands and web preview", 10, all(cmd in read("README.md") for cmd in ["npm test", "npm run build", "npm run test:contracts", "npm run demo", "npm run evaluate", "npm audit", "python3 -m http.server 4173 --directory web"])),
        ("Final DOCX verification text has no blank placeholders when available", 6, final_docx_has_no_blanks_when_available()),
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
