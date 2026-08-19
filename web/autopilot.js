// SPDX-License-Identifier: Apache-2.0
// 160-second autopilot demo: a declarative, validated timeline that walks the
// four acts hands-free while toast captions narrate what is running and why.
// Pure logic (no DOM, no Date.now): the executor only uses an injectable clock,
// so the exact same timeline is unit-tested in Vitest and driven in the browser
// by the thin driver in app.js. Every judgement shown on screen is produced by
// the real engines (Ed25519 verify, nullifier rules, replay, CII), never faked.

export const AUTOPILOT_TOTAL_MS = 160_000;
export const AUTOPILOT_TICK_MS = 200;

// Act windows drive the segmented progress HUD. The finale lives inside act 4.
export const AUTOPILOT_ACTS = [
  { n: 1, label: '문제 정의', from: 0, to: 18_000 },
  { n: 2, label: '원장 시뮬레이터', from: 18_000, to: 72_000 },
  { n: 3, label: '공격 극장', from: 72_000, to: 124_000 },
  { n: 4, label: '무결성 검증', from: 124_000, to: 160_000 }
];

export const AUTOPILOT_ACTIONS = [
  'begin',
  'caption',
  'chip',
  'highlight',
  'scrollTo',
  'submitStep',
  'compareNullifiers',
  'prepareAttacks',
  'revealAttack',
  'tamper',
  'finale',
  'end'
];

export function actAt(ms) {
  const act = AUTOPILOT_ACTS.find((a) => ms >= a.from && ms < a.to);
  return act ? act.n : AUTOPILOT_ACTS[AUTOPILOT_ACTS.length - 1].n;
}

// "Coming up next" lookup for the subtitle panel: the first caption scheduled
// strictly after `ms`, so viewers always see what the autopilot will do next.
export function nextCaptionAfter(timeline, ms) {
  const next = timeline.find((s) => s.action === 'caption' && s.at > ms);
  return next ? { at: next.at, act: next.params.act, title: next.params.title } : null;
}

const step = (at, action, params = {}) => ({ at, action, params });
const cap = (at, act, title, detail) => step(at, 'caption', { act, title, detail });

// NOTE: submitStep entries must mirror demoEngine.SCRIPTED_SCENARIO one-to-one.
// tests/autopilot.test.ts fails if the two ever drift apart.
export const AUTOPILOT_TIMELINE = [
  // ── ACT 1 · 문제 정의 (0–18s) ────────────────────────────────────────────
  step(0, 'begin'),
  cap(400, 1, '오토파일럿 시연을 시작합니다',
    '지금부터 160초 동안 4개 막을 자동으로 순회합니다. 화면의 모든 판정은 이 브라우저에서 실제 코드가 실행한 결과입니다.'),
  cap(5_000, 1, '문제: 중복수혜 검증과 개인정보 보호의 충돌',
    '공모전, 장학금, 복지 바우처는 중복 신청을 걸러내야 합니다. 지금은 그 검증을 위해 기관끼리 주민번호 같은 원본 개인정보를 대조합니다.'),
  step(10_000, 'highlight', { target: '.kpi-privacy' }),
  cap(10_300, 1, '해법: 공개 원장에 개인정보 0필드',
    'CivicProof는 원본을 각 기관 안에만 두고, 공개 장부에는 신원을 숨긴 익명 지문(널리파이어)과 서명 증빙만 남깁니다. 지문은 사업마다 다르게 찍힙니다.'),
  step(11_000, 'chip', { text: '온체인 개인정보 0필드', tone: 'good' }),
  cap(14_500, 1, '배경 애니메이션이 곧 시스템 원리입니다',
    '신원 입자가 해시 방벽을 지나면 사업별 익명 지문 타일로 바뀝니다. 이제 실제 신청을 발생시켜 보겠습니다.'),

  // ── ACT 2 · 원장 시뮬레이터 (18–72s) ────────────────────────────────────
  step(17_400, 'scrollTo', { target: '#simulator' }),
  cap(18_200, 2, '2막: 원장 시뮬레이터',
    '시민 3명이 사업 3종에 신청합니다. 수리와 차단 판정은 Ed25519 서명 검증과 익명 지문 규칙이 지금 실시간으로 내립니다.'),
  step(24_000, 'submitStep', { citizenId: 'citizen-a-private-id', programId: 'osscontest-2026' }),
  cap(24_300, 2, '실행 중: 시민 A가 오픈소스 공모전에 신청',
    '기관이 원본 ID를 해시해 익명 지문을 만들고, 서명한 자격증명을 발급합니다. 원본 개인정보는 기관 밖으로 나가지 않으며, 최초 신청이라 수리됩니다.'),
  step(27_500, 'chip', { text: '수리 · 널리파이어 신규 등록', tone: 'good' }),
  step(32_000, 'submitStep', { citizenId: 'citizen-b-private-id', programId: 'osscontest-2026' }),
  cap(32_300, 2, '실행 중: 시민 B가 같은 공모전에 신청',
    '사람이 다르면 지문도 다릅니다. 같은 사업이라도 정상 수리됩니다.'),
  step(40_000, 'submitStep', { citizenId: 'citizen-a-private-id', programId: 'scholarship-2026' }),
  cap(40_300, 2, '실행 중: 시민 A가 창업 장학금에도 신청',
    '사업이 다르면 같은 사람이라도 지문이 달라집니다. 두 신청을 한 사람으로 연결할 수 없어 사업 간 교차 추적이 차단됩니다.'),
  step(43_500, 'chip', { text: '다른 사업 = 다른 익명 지문', tone: 'info' }),
  step(48_000, 'submitStep', { citizenId: 'citizen-a-private-id', programId: 'osscontest-2026' }),
  cap(48_300, 2, '실행 중: 시민 A가 공모전에 다시 신청',
    '같은 사업에 같은 지문이 이미 등록되어 있어 중복으로 즉시 차단됩니다. 원본 기록은 덮어쓰지 않고 차단 이벤트만 남습니다.'),
  step(51_500, 'chip', { text: '중복 신청 차단', tone: 'warn' }),
  step(56_000, 'submitStep', { citizenId: 'citizen-c-private-id', programId: 'voucher-2026' }),
  cap(56_300, 2, '실행 중: 시민 C가 복지 바우처에 신청',
    '여기까지 수리 4건, 중복 차단 1건입니다. 감사 로그에는 개인정보 없이 이벤트만 쌓였습니다.'),
  step(63_000, 'compareNullifiers', {}),
  cap(63_300, 2, '같은 사람, 서로 다른 익명 지문',
    '시민 A가 공모전에 남긴 지문과 장학금에 남긴 지문을 나란히 비교합니다. 사업 이름이 지문 재료에 들어가 값이 달라지므로, 추적 불가는 약속이 아니라 수학입니다.'),

  // ── ACT 3 · 공격 극장 (72–124s) ─────────────────────────────────────────
  step(71_400, 'scrollTo', { target: '#attacks' }),
  step(72_200, 'prepareAttacks', {}),
  cap(72_400, 3, '3막: 레드팀 공격 극장',
    '"공격자가 이렇게 하면요?"라는 질문 12가지를 실행 가능한 코드로 만들었습니다. 지금 이 브라우저에서 하나씩 실제로 실행합니다.'),
  cap(78_000, 3, '실행 중: 증빙 공격 5종',
    '증빙 위변조, 서명 제거, 발급자 키 위조, DID 치환, 만료 재사용. 정규화 서명 검증과 발급자 허가목록이 전부 거부합니다.'),
  step(79_500, 'revealAttack', { index: 0 }),
  step(82_500, 'revealAttack', { index: 1 }),
  step(85_500, 'revealAttack', { index: 2 }),
  step(88_500, 'revealAttack', { index: 3 }),
  step(91_500, 'revealAttack', { index: 4 }),
  cap(94_000, 3, '실행 중: 원장·프라이버시 공격 3종',
    '같은 사업 재등록은 지문 중복 검사가 막고, 교차 추적은 지문 값 자체가 달라 실패하며, 비정상 입력은 32바이트 hex 형식 검증이 거릅니다.'),
  step(95_500, 'revealAttack', { index: 5 }),
  step(98_500, 'revealAttack', { index: 6 }),
  step(101_500, 'revealAttack', { index: 7 }),
  cap(104_000, 3, '실행 중: 증명 위조 공격 3종',
    'Schnorr 응답 변조, 다른 사업 재사용, 머클 형제 경로 교체. Fiat-Shamir 챌린지 결속과 루트 재계산이 전부 거부합니다.'),
  step(105_500, 'revealAttack', { index: 8 }),
  step(108_500, 'revealAttack', { index: 9 }),
  step(111_500, 'revealAttack', { index: 10 }),
  cap(114_000, 3, '실행 중: 감사 로그 위조 공격',
    '등록된 적 없는 중복 이벤트를 감사 로그에 주입합니다. Replay-Verify가 로그만으로 상태를 재구축해 순서 위반을 잡아냅니다.'),
  step(115_500, 'revealAttack', { index: 11 }),
  step(118_000, 'chip', { text: '공격 12종 전부 차단', tone: 'good' }),
  cap(118_300, 3, '결과: 12 / 12 차단',
    '이 공격 코퍼스는 CI에 상시 편입되어 있습니다. 방어가 약해지는 회귀가 생기면 빌드 자체가 실패합니다.'),

  // ── ACT 4 · 무결성 검증 (124–160s) ──────────────────────────────────────
  step(123_400, 'scrollTo', { target: '#dashboard' }),
  step(124_200, 'highlight', { target: '.gauge-card' }),
  cap(124_400, 4, '4막: 시민 무결성 지수(CII)',
    '감사 일치 40, 중복 차단 30, 증빙 유효 20, 개인정보 최소화 10을 합산하는 결정적 공식입니다. 모델도 난수도 없어 누구나 같은 점수를 재현합니다.'),
  cap(129_500, 4, '이제 장부를 조작해 보겠습니다',
    '등록된 적 없는 가짜 중복 이벤트를 감사 로그에 끼워 넣습니다. 조작된 장부가 그대로 통과하는지 지켜보세요.'),
  step(132_000, 'tamper', { phase: 'inject' }),
  step(132_400, 'chip', { text: '감사 로그 조작 주입', tone: 'warn' }),
  step(134_000, 'highlight', { target: '.replay-card' }),
  cap(134_300, 4, 'Replay-Verify가 조작을 탐지했습니다',
    '이벤트 로그만으로 상태를 재구축해 대조하니 순서 위반(EVENT_ORDER_VIOLATION)이 드러납니다. 지수는 100에서 60 WATCH로 떨어집니다.'),
  step(141_000, 'tamper', { phase: 'recover' }),
  step(141_400, 'chip', { text: 'CII 100 EXCELLENT 복구', tone: 'good' }),
  cap(141_600, 4, '조작 이벤트 제거, 지수 복구',
    '깨끗한 로그로 다시 계산하면 100점 EXCELLENT로 돌아옵니다. 장부를 믿지 말고 다시 계산하라, 이것이 CivicProof의 핵심 규율입니다.'),
  step(147_000, 'highlight', { target: '.root-row' }),
  cap(147_300, 4, '상태 루트 대조',
    '수리된 클레임 전체를 정렬 해시한 상태 루트가 일치할 때만 MATCH입니다. 조작은 말이 아니라 숫자로 드러납니다.'),

  // ── 피날레 (152–160s) ───────────────────────────────────────────────────
  step(152_000, 'finale', {}),
  cap(152_300, 4, '160초 검증 요약',
    '수리 4건, 중복 차단 1건, 공격 12종 전부 차단, CII 100점, Replay MATCH. 방금 본 전 과정은 저장소의 코드와 자동 테스트로 그대로 재현됩니다.'),
  step(AUTOPILOT_TOTAL_MS, 'end')
];

export function validateTimeline(steps) {
  const errors = [];
  const push = (msg) => errors.push(msg);

  if (!Array.isArray(steps) || steps.length === 0) {
    return { ok: false, errors: ['timeline must be a non-empty array'] };
  }

  let prevAt = -1;
  for (const [i, s] of steps.entries()) {
    if (!Number.isInteger(s.at) || s.at < 0 || s.at > AUTOPILOT_TOTAL_MS) {
      push(`step ${i}: at=${s.at} out of range [0, ${AUTOPILOT_TOTAL_MS}]`);
    }
    if (s.at < prevAt) push(`step ${i}: timeline not sorted at ${s.at}ms`);
    prevAt = Math.max(prevAt, s.at ?? 0);
    if (!AUTOPILOT_ACTIONS.includes(s.action)) push(`step ${i}: unknown action "${s.action}"`);

    if (s.action === 'caption') {
      const { act, title, detail } = s.params ?? {};
      if (![1, 2, 3, 4].includes(act)) push(`step ${i}: caption act must be 1..4`);
      if (typeof title !== 'string' || title.trim().length === 0) push(`step ${i}: caption title empty`);
      if (typeof detail !== 'string' || detail.trim().length < 10) push(`step ${i}: caption detail too short`);
    }
    if (s.action === 'chip' && !(typeof s.params?.text === 'string' && s.params.text.trim())) {
      push(`step ${i}: chip text empty`);
    }
    if ((s.action === 'highlight' || s.action === 'scrollTo') && !(typeof s.params?.target === 'string' && s.params.target.trim())) {
      push(`step ${i}: ${s.action} target empty`);
    }
    if (s.action === 'submitStep') {
      const { citizenId, programId } = s.params ?? {};
      if (!citizenId || !programId) push(`step ${i}: submitStep needs citizenId and programId`);
    }
    if (s.action === 'tamper' && !['inject', 'recover'].includes(s.params?.phase)) {
      push(`step ${i}: tamper phase must be inject|recover`);
    }
  }

  const byAction = (name) => steps.filter((s) => s.action === name);
  const first = steps[0];
  const last = steps[steps.length - 1];
  if (!(first.at === 0 && first.action === 'begin')) push('timeline must open with begin at 0ms');
  if (!(last.at === AUTOPILOT_TOTAL_MS && last.action === 'end')) {
    push(`timeline must close with end at exactly ${AUTOPILOT_TOTAL_MS}ms`);
  }
  for (const name of ['begin', 'end', 'finale', 'prepareAttacks', 'compareNullifiers']) {
    if (byAction(name).length !== 1) push(`expected exactly one ${name} step`);
  }

  const reveals = byAction('revealAttack');
  const indexes = reveals.map((s) => s.params?.index);
  if (indexes.length !== 12 || new Set(indexes).size !== 12 || indexes.some((v, i) => v !== i)) {
    push('revealAttack must cover indexes 0..11 exactly once, in order');
  }
  const prepare = byAction('prepareAttacks')[0];
  if (prepare && reveals.some((s) => s.at <= prepare.at)) push('all revealAttack steps must come after prepareAttacks');

  const tampers = byAction('tamper');
  const inject = tampers.find((s) => s.params.phase === 'inject');
  const recover = tampers.find((s) => s.params.phase === 'recover');
  if (!inject || !recover || tampers.length !== 2) push('tamper must appear exactly twice: inject then recover');
  else if (inject.at >= recover.at) push('tamper inject must precede recover');

  if (byAction('submitStep').length !== 5) push('expected 5 submitStep entries (scripted scenario)');

  for (const act of AUTOPILOT_ACTS) {
    const count = byAction('caption').filter((s) => s.params.act === act.n).length;
    if (count < 3) push(`act ${act.n} needs at least 3 captions, has ${count}`);
  }

  const finale = byAction('finale')[0];
  if (finale && finale.at < 150_000) push('finale must start at 150s or later');

  return { ok: errors.length === 0, errors };
}

const defaultClock = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id)
};

// Executes a timeline against a driver. speed > 1 compresses wall-clock time
// (test hook, ?apspeed=N in the browser) without touching timeline semantics.
export function createAutopilot({ driver, timeline = AUTOPILOT_TIMELINE, speed = 1, clock = defaultClock, onFinish, onError } = {}) {
  if (!driver) throw new Error('createAutopilot requires a driver');
  const validation = validateTimeline(timeline);
  if (!validation.ok) throw new Error(`invalid timeline: ${validation.errors[0]}`);
  const rate = Math.min(Math.max(Number(speed) || 1, 0.25), 40);

  let running = false;
  let timers = [];
  let elapsed = 0;
  const errors = [];

  function dispatch(s) {
    if (!running) return;
    try {
      const result = driver[s.action]?.(s.params, s);
      if (result && typeof result.catch === 'function') {
        result.catch((err) => recordError(s, err));
      }
    } catch (err) {
      recordError(s, err);
    }
  }

  function recordError(s, err) {
    errors.push({ action: s.action, at: s.at, message: err?.message ?? String(err) });
    onError?.(errors[errors.length - 1]);
  }

  function start() {
    if (running) return false;
    running = true;
    elapsed = 0;
    timers = timeline.map((s) =>
      clock.setTimeout(() => {
        if (s.action === 'end') finish('completed');
        else dispatch(s);
      }, s.at / rate)
    );
    const tick = () => {
      if (!running) return;
      elapsed = Math.min(elapsed + AUTOPILOT_TICK_MS, AUTOPILOT_TOTAL_MS);
      driver.progress?.({
        elapsed,
        total: AUTOPILOT_TOTAL_MS,
        fraction: elapsed / AUTOPILOT_TOTAL_MS,
        act: actAt(Math.min(elapsed, AUTOPILOT_TOTAL_MS - 1))
      });
      if (elapsed < AUTOPILOT_TOTAL_MS) timers.push(clock.setTimeout(tick, AUTOPILOT_TICK_MS / rate));
    };
    timers.push(clock.setTimeout(tick, AUTOPILOT_TICK_MS / rate));
    return true;
  }

  function clearTimers() {
    for (const id of timers) clock.clearTimeout(id);
    timers = [];
  }

  function finish(reason) {
    if (!running) return;
    // dispatch the terminal driver hooks while still marked running, then stop.
    try {
      driver.progress?.({
        elapsed: AUTOPILOT_TOTAL_MS,
        total: AUTOPILOT_TOTAL_MS,
        fraction: 1,
        act: AUTOPILOT_ACTS[AUTOPILOT_ACTS.length - 1].n
      });
      driver.end?.({ reason, errors: [...errors] });
    } catch (err) {
      recordError({ action: 'end', at: AUTOPILOT_TOTAL_MS }, err);
    }
    running = false;
    clearTimers();
    onFinish?.({ reason, errors: [...errors] });
  }

  function stop() {
    if (!running) return false;
    running = false;
    clearTimers();
    try {
      driver.cleanup?.({ reason: 'stopped', errors: [...errors] });
    } catch {
      // cleanup best-effort by design
    }
    return true;
  }

  return {
    start,
    stop,
    isRunning: () => running,
    getErrors: () => [...errors]
  };
}
