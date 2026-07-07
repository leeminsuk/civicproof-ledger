# CivicProof Ledger — 개인정보 비공개 중복수혜 검증 원장

> English documentation: [README.md](README.md) · 라이브 데모: <https://leeminsuk.github.io/civicproof-ledger/>

공모전·장학금·연구지원·복지 바우처처럼 "동일 사업 내 1인 1회" 원칙이 필요한 공공지원 사업을 위해, **기관 간 원본 개인정보 공유 없이** 중복수혜를 검증하는 오픈소스 원장입니다. 공공지원의 부정 중복수혜와 개인정보 유출 위험이라는 국민생활 속 사회문제를 블록체인·보안 기술로 해결합니다.

## 문제와 접근

현행 중복수혜 검증은 기관 간 주민등록번호·연락처 등 **원본 개인정보 대조**에 의존해 최소수집·목적제한 원칙과 충돌합니다. CivicProof는 원본 식별자를 각 기관 내부에만 두고, 공개 원장에는 다음만 기록합니다.

- **프로그램별 격리 널리파이어**: `SHA-256(programId ‖ subjectId ‖ salt)` — 같은 사업 재신청은 같은 값이 나와 즉시 탐지되지만, 다른 사업에서는 값이 달라 **교차 추적이 구조적으로 불가능**합니다.
- **Ed25519 서명 검증가능 자격증명(VC)**: RFC 8785 정규화 JSON 서명으로 위변조·발급자 불일치·만료를 판별합니다.
- **감사 이벤트 로그**: 개인식별정보 0필드. 이 로그만으로 누구나 원장 전체를 재검산할 수 있습니다.

## 3대 검증 엔진 (전부 코드·테스트·시연으로 존재)

| 엔진 | 위치 | 역할 |
|------|------|------|
| Replay-Verify | `src/replay.ts` | 공개 이벤트 로그만으로 원장 상태를 재구축해 결정적 상태루트를 비교. 카운터 조작·클레임 밀반입·커밋먼트 교체·순서 위조를 유형별 코드로 보고 |
| 시민 무결성 지수 cii-v1 | `src/integrityIndex.ts` | 감사일치 40 + 중복차단 30 + 증빙유효 20 + 개인정보최소화 10의 결정적 0~100점. 모델·난수 없음 — 누구나 같은 숫자를 재현 |
| 레드팀 공격 코퍼스 | `src/attackCorpus.ts` | "공격자가 ~하면?"을 실행 가능한 12종 시나리오(ATK-01~12)로 코드화. 12/12 차단이 아니면 CI가 실패 |

여기에 v1.0.0부터 **property 기반 퍼징**(fast-check)이 추가되어, 수백 개의 무작위 시나리오에서 리플레이 왕복 일치·조작 시 반드시 탐지·프로그램 격리 불변식을 상시 검증합니다.

## 빠른 시작

```sh
nvm use        # Node 22
npm ci
npm test               # 단위 + property 퍼징 스위트
npm run coverage       # 커버리지 임계 게이트
npm run build          # strict TypeScript
npm run test:contracts # Hardhat 컨트랙트 테스트
npm run demo           # E2E 데모: 수리 2·중복 차단 1·Replay MATCH·CII 100/100
npm run redteam        # 레드팀 12/12 차단 확인
npm run evaluate       # 문서 주장 vs 코드 자동 대조 하네스
npm run sbom:check     # SBOM이 잠금파일과 일치하는지 검증
npm audit              # 취약점 0
```

웹 데모를 로컬에서 열려면: `python3 -m http.server 4173 --directory web` → <http://127.0.0.1:4173/>

## 재사용 CLI

데모 전용이 아니라 외부 파일에도 쓸 수 있는 도구입니다.

```sh
npm run cli -- issue --program osscontest-2026 --subject alice --salt agency-secret   # VC 발급(JSON 출력)
npm run cli -- verify credential.json                                                # 서명·만료 검증
npm run cli -- replay examples/scenario-clean.json                                   # 이벤트 로그 재검산(상태루트·통계)
npm run cli -- replay examples/scenario-tampered.json                                # 조작 로그 → 순서 위반 검출, 종료코드 1
npm run cli -- cii examples/scenario-clean.json                                      # 무결성 지수 산출
```

## 4막 인터랙티브 데모

<https://leeminsuk.github.io/civicproof-ledger/>

1. **히어로** — 개인정보가 해시 방벽을 지나 널리파이어로 바뀌는 애니메이션, 온체인 PII 0필드 KPI
2. **원장 시뮬레이터** — 시민×사업 클릭으로 수리/중복/교차추적 불가를 눈으로 확인
3. **공격 극장** — 레드팀 12종을 브라우저에서 실제 실행해 12/12 차단
4. **무결성 대시보드** — CII 게이지, 감사 로그 조작 토글 시 지수가 100→60으로 하락 후 복구

## 아키텍처 요약

발급(기관 로컬 원본·VC 서명) → 원장(Solidity `ClaimRegistry`, 발급기관 허가목록 RBAC) → 감사(공개 이벤트·Replay-Verify·CII) → 웹(정적 검증기, XSS 원천 차단) → CI/하네스(10게이트). 상세: [docs/architecture.md](docs/architecture.md) · [docs/security.md](docs/security.md)

## 대회 규정 정합성 (2026 오픈소스 개발자대회 운영규정 기준)

| 규정 | 이행 |
|------|------|
| 제8조 OSI 라이선스 의무 | 직접 작성 코드 전체 Apache-2.0, 전 소스 SPDX 헤더, `NOTICE`·`docs/licenses.md` |
| 제9조 AI 모델 활용 기준 | 런타임 AI 모델 미탑재(판정 전부 결정적 코드). 개발 보조 AI 사용 범위는 결과보고서 붙임2에 명시 |
| 제10조 소스코드 공개 | GitHub 공개 저장소, 5년 공개 유지 방침, 심사·검증 가능한 전체 소스 포함 |
| SBOM | `sbom.spdx.json` (SPDX 2.3) — `npm run sbom`으로 재생성, CI가 신선도 검증 |

## 프로젝트 문서

[CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · [SECURITY.md](SECURITY.md) · [CHANGELOG.md](CHANGELOG.md) · [CITATION.cff](CITATION.cff)

## 라이선스

[Apache License 2.0](LICENSE) © 2026 CivicProof Ledger contributors
