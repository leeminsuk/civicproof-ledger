// SPDX-License-Identifier: Apache-2.0
import { mountHero } from './hero.js';
import { shortHex } from './verifier.js';
import {
  CITIZENS,
  PROGRAMS,
  SCRIPTED_SCENARIO,
  auditProofsFor,
  createSimulator,
  programLabel,
  runAttackCorpus,
  tamperEvents
} from './demoEngine.js';
import {
  AUTOPILOT_ACTS,
  AUTOPILOT_TIMELINE,
  AUTOPILOT_TOTAL_MS,
  createAutopilot,
  nextCaptionAfter
} from './autopilot.js';

// ── tiny DOM helpers: build nodes via createElement + textContent only, so
// no raw-markup sink is ever used (XSS-safe against pasted content). ──
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child) node.append(child);
  }
  return node;
}
function svg(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}
const $ = (sel) => document.querySelector(sel);

const sim = createSimulator();
let dashboardEvents = () => sim.events;

// ── ACT 1: hero ──
mountHero($('#hero-canvas'));

const kpi = {
  accepted: $('#kpi-accepted'),
  duplicate: $('#kpi-duplicate'),
  programs: $('#kpi-programs'),
  pii: $('#kpi-pii')
};
function animateTo(node, target) {
  const start = Number(node.textContent) || 0;
  if (start === target) return;
  const steps = 10;
  let i = 0;
  const timer = setInterval(() => {
    i += 1;
    node.textContent = String(Math.round(start + ((target - start) * i) / steps));
    if (i >= steps) clearInterval(timer);
  }, 24);
}

// ── ACT 2: simulator board ──
const applyBoard = $('#apply-board');
const ledger = $('#ledger');
const ledgerCount = $('#ledger-count');
const lastResult = $('#last-result');

function buildBoard() {
  applyBoard.replaceChildren(
    ...CITIZENS.map((citizen) =>
      el('div', { class: 'citizen-row' }, [
        el('div', { class: 'citizen-name' }, [
          el('span', { class: 'citizen-dot', style: `background:${citizen.color}` }),
          el('span', { text: citizen.label })
        ]),
        el(
          'div',
          { class: 'apply-buttons' },
          PROGRAMS.map((program) => {
            const button = el('button', { class: 'apply-btn', type: 'button', text: `→ ${program.label}` });
            button.addEventListener('click', () => submit(citizen.id, program.id));
            return button;
          })
        )
      ])
    )
  );
}

async function submit(citizenId, programId) {
  const result = await sim.submit(citizenId, programId);
  renderLedgerItem(result);
  showLastResult(result);
  refreshMetricsAndDashboard();
  return result;
}

function renderLedgerItem(result) {
  const item = el('li', { class: `ledger-item ${result.status}` }, [
    el('span', { class: 'ev-tag', text: result.status === 'accepted' ? '수리' : '중복차단' }),
    el('span', { class: 'ev-mid' }, [
      el('span', { text: `${result.citizenLabel} · ${result.programLabel}` }),
      el('small', { text: result.status === 'accepted' ? '최초 등록됨' : '이미 등록된 익명 지문' })
    ]),
    el('code', { text: shortHex(result.nullifierHash) })
  ]);
  ledger.prepend(item);
  ledgerCount.textContent = `${sim.events.length}건`;
  return item;
}

function showLastResult(result) {
  lastResult.hidden = false;
  const badge = lastResult.querySelector('.lr-badge');
  badge.className = `lr-badge ${result.status}`;
  badge.textContent = result.status === 'accepted' ? 'ACCEPTED' : 'DUPLICATE';
  lastResult.querySelector('.lr-text').textContent =
    result.status === 'accepted'
      ? `서명 검증 통과 · 사업별 익명 지문 신규 등록`
      : `서명은 유효하나 같은 사업의 익명 지문이 이미 존재 → 차단`;
  lastResult.querySelector('.lr-nullifier').textContent = shortHex(result.nullifierHash, 14, 8);
}

$('#reset-sim').addEventListener('click', () => {
  sim.reset();
  ledger.replaceChildren();
  ledgerCount.textContent = '0건';
  lastResult.hidden = true;
  dashboardEvents = () => sim.events;
  refreshMetricsAndDashboard();
});

$('#play-scenario').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  sim.reset();
  ledger.replaceChildren();
  dashboardEvents = () => sim.events;
  for (const step of SCRIPTED_SCENARIO) {
    await submit(step.citizenId, step.programId);
    await sleep(720);
  }
  button.disabled = false;
});

// ── ACT 3: attack theater ──
const attackGrid = $('#attack-grid');
const attackSummary = $('#attack-summary');
const attackScore = $('#attack-score');

const CATEGORY_KO = {
  credential: '증빙',
  ledger: '원장',
  proof: '증명',
  'audit-log': '감사로그',
  privacy: '프라이버시'
};

function buildAttackPlaceholders(count) {
  attackGrid.replaceChildren(
    ...Array.from({ length: count }, (_, i) =>
      el('div', { class: 'attack-card pending', 'data-slot': String(i) }, [
        el('div', { class: 'ac-head' }, [
          el('span', { class: 'ac-id', text: `ATK-${String(i + 1).padStart(2, '0')}` }),
          el('span', { class: 'ac-status', text: '대기' })
        ]),
        el('div', { class: 'ac-name', text: '준비됨' }),
        el('div', { class: 'ac-defense', text: '' })
      ])
    )
  );
}

function fillAttackCard(index, result) {
  const card = attackGrid.querySelector(`[data-slot="${index}"]`);
  if (!card) return;
  card.className = `attack-card ${result.blocked ? 'done' : 'leaked'}`;
  card.querySelector('.ac-status').textContent = result.blocked ? '차단' : '유출!';
  card.querySelector('.ac-name').textContent = result.name;
  const defense = card.querySelector('.ac-defense');
  defense.replaceChildren(
    document.createTextNode(result.defense),
    el('span', { class: 'ac-cat', text: CATEGORY_KO[result.category] ?? result.category })
  );
}

$('#run-attacks').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  const report = await runAttackCorpus();
  buildAttackPlaceholders(report.total);
  attackSummary.hidden = false;
  let blocked = 0;
  for (let i = 0; i < report.results.length; i++) {
    await sleep(180);
    fillAttackCard(i, report.results[i]);
    if (report.results[i].blocked) blocked += 1;
    attackScore.textContent = `${blocked} / ${report.total}`;
  }
  button.disabled = false;
});

// ── ACT 4: dashboard ──
const gauge = $('#gauge');
const gaugeGrade = $('#gauge-grade');
const subscoresBox = $('#subscores');
const replayBadge = $('#replay-badge');
const replayText = $('#replay-text');
const stateRoot = $('#state-root');
const divergences = $('#divergences');
const programPressure = $('#program-pressure');

const GRADE_COLOR = { EXCELLENT: '#4ade80', GOOD: '#38bdf8', WATCH: '#f5b13d', ALERT: '#f5665f' };
const SUBSCORE_META = [
  { key: 'auditConsistency', label: '감사 일치', max: 40 },
  { key: 'duplicateContainment', label: '중복 차단', max: 30 },
  { key: 'credentialIntegrity', label: '증빙 유효', max: 20 },
  { key: 'privacyMinimization', label: '개인정보 최소화', max: 10 }
];

function renderGauge(score, grade) {
  const color = GRADE_COLOR[grade] ?? '#4ade80';
  const r = 78;
  const c = 2 * Math.PI * r;
  gauge.replaceChildren();
  gauge.append(
    svg('circle', { cx: 100, cy: 100, r, fill: 'none', stroke: 'rgba(147,163,189,0.16)', 'stroke-width': 14 }),
    svg('circle', {
      cx: 100,
      cy: 100,
      r,
      fill: 'none',
      stroke: color,
      'stroke-width': 14,
      'stroke-linecap': 'round',
      'stroke-dasharray': String(c),
      'stroke-dashoffset': String(c * (1 - score / 100)),
      transform: 'rotate(-90 100 100)',
      style: 'transition: stroke-dashoffset 0.6s ease, stroke 0.3s ease'
    })
  );
  const big = svg('text', { x: 100, y: 96, 'text-anchor': 'middle', fill: '#e8eef8', 'font-size': 42, 'font-weight': 800 });
  big.textContent = String(score);
  const small = svg('text', { x: 100, y: 122, 'text-anchor': 'middle', fill: '#93a3bd', 'font-size': 14 });
  small.textContent = '/ 100';
  gauge.append(big, small);
  gaugeGrade.textContent = grade;
  gaugeGrade.style.color = color;
}

function renderSubscores(subscores) {
  subscoresBox.replaceChildren(
    ...SUBSCORE_META.map((meta) => {
      const value = subscores[meta.key];
      const fill = el('i', { style: `width:${(value / meta.max) * 100}%` });
      return el('div', { class: 'subscore' }, [
        el('div', { class: 'subscore-top' }, [
          el('span', { text: meta.label }),
          el('b', { text: `${value} / ${meta.max}` })
        ]),
        el('div', { class: 'bar' }, [fill])
      ]);
    })
  );
}

function renderReplay(replay, index) {
  replayBadge.className = `replay-badge ${replay.match ? 'match' : 'diverged'}`;
  replayBadge.textContent = replay.match ? 'MATCH' : 'DIVERGED';
  replayText.textContent = replay.match
    ? `이벤트 ${index ? '' : ''}로그만으로 재구축한 상태가 원장과 일치합니다. 수리 ${replay.derived.acceptedClaims}건 · 중복 ${replay.derived.duplicateAttempts}건 재검산됨.`
    : `이벤트 로그와 원장 상태가 어긋납니다. 순서 위반 ${replay.orderViolations.length}건 탐지.`;
  const items = [];
  if (!replay.match) {
    for (const key of replay.orderViolations) {
      items.push(el('li', { text: `EVENT_ORDER_VIOLATION · ${key}` }));
    }
  }
  divergences.replaceChildren(...items);
}

async function renderStateRoot(events) {
  const encoder = new TextEncoder();
  const payload = events
    .filter((e) => e.accepted)
    .map((e) => `${e.programId}:${e.nullifierHash}:${e.commitmentHash}`)
    .sort()
    .join('|');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(`civicproof:state-root:v1\0${payload}`));
  const hex = `0x${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  stateRoot.textContent = shortHex(hex, 12, 8);
}

function renderProgramPressure(perProgram) {
  if (perProgram.length === 0) {
    programPressure.replaceChildren(el('p', { class: 'replay-text', text: '아직 신청 데이터가 없습니다.' }));
    return;
  }
  programPressure.replaceChildren(
    ...perProgram.map((row) =>
      el('div', { class: 'pp-row' }, [
        el('div', { class: 'pp-top' }, [
          el('span', { text: programLabel(row.programId) }),
          el('small', { text: `중복 ${row.duplicates} / 총 ${row.accepted + row.duplicates}` })
        ]),
        el('div', { class: 'pp-bar' }, [el('i', { style: `width:${row.pressure}%` })])
      ])
    )
  );
}

function refreshMetricsAndDashboard() {
  const metrics = sim.metrics();
  animateTo(kpi.accepted, metrics.acceptedClaims);
  animateTo(kpi.duplicate, metrics.duplicateAttempts);
  animateTo(kpi.programs, metrics.programs);
  kpi.pii.textContent = '0';
  renderDashboard();
}

function renderDashboard() {
  const events = dashboardEvents();
  const proofs = auditProofsFor(events);
  renderGauge(proofs.index.score, proofs.index.grade);
  renderSubscores(proofs.index.subscores);
  renderReplay(proofs.replay, proofs.index);
  renderProgramPressure(proofs.perProgram);
  renderStateRoot(events);
}

// One-shot tamper demo: inject a forged audit event so the dashboard drops
// (CII 100 EXCELLENT → 60 WATCH, Replay-Verify MATCH → DIVERGED), then let
// Replay-Verify "catch" it and auto-recover to the clean state. No manual
// toggle to reset — the button tells the whole story and returns on its own.
const tamperBtn = $('#tamper-demo');
const tamperLabel = tamperBtn.querySelector('.tamper-label');
let tamperPlaying = false;

function setTamperVisual(state) {
  tamperBtn.classList.toggle('playing', state === 'playing');
  tamperBtn.classList.toggle('recovering', state === 'recovering');
  tamperLabel.textContent =
    state === 'playing'
      ? '① 감사 로그 조작 주입 — 지수 하락'
      : state === 'recovering'
        ? '② Replay-Verify가 조작 탐지 → 복구'
        : '감사 로그 조작 시뮬레이션';
  tamperBtn.disabled = state !== 'idle';
}

function applyTamperView(on) {
  dashboardEvents = on ? () => tamperEvents(sim.events) : () => sim.events;
  renderDashboard();
}

tamperBtn.addEventListener('click', async () => {
  if (tamperPlaying) return;
  tamperPlaying = true;

  // 1) inject the forged event → dashboard diverges
  setTamperVisual('playing');
  applyTamperView(true);
  await sleep(2400);

  // 2) Replay-Verify detects the divergence and the state is recomputed clean
  setTamperVisual('recovering');
  applyTamperView(false);
  await sleep(1500);

  // 3) back to idle
  setTamperVisual('idle');
  tamperPlaying = false;
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── AUTOPILOT: 160-second hands-free tour ──────────────────────────────────
// The timeline and executor live in autopilot.js (pure, unit-tested); this
// block is only the DOM driver: control-room HUD, subtitle captions,
// achievement chips, spotlight rings and the finale summary overlay.
const apLayer = $('#autopilot-layer');
const apStartBtn = $('#autopilot-start');
const REDUCED_MOTION = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const AP_SPEED = (() => {
  const raw = Number(new URLSearchParams(globalThis.location?.search ?? '').get('apspeed'));
  return Number.isFinite(raw) && raw >= 1 && raw <= 40 ? raw : 1;
})();

let apRunner = null;
const apState = { ui: {}, ledgerItems: new Map(), attackReport: null, blocked: 0, spots: [] };

function apFmt(ms) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function apBuildHud() {
  const segs = AUTOPILOT_ACTS.map((act) =>
    el('div', { class: 'ap-seg', 'data-act': String(act.n), style: `flex-grow:${act.to - act.from}` }, [
      el('small', { text: `${act.n}막 ${act.label}` })
    ])
  );
  const line = el('i', { class: 'ap-line' });
  const track = el('div', { class: 'ap-track' }, [...segs, line]);
  const rec = el('span', { class: 'ap-rec' }, [el('i', { class: 'ap-rec-dot' }), el('span', { text: 'AUTO 시연' })]);
  const time = el('span', { class: 'ap-time', text: `0:00 / ${apFmt(AUTOPILOT_TOTAL_MS)}` });
  const stop = el('button', { class: 'ap-stop', type: 'button', text: '✕ 종료 (ESC)' });
  stop.addEventListener('click', () => (apRunner?.isRunning() ? apRunner.stop() : apTeardown()));
  const hud = el('div', { class: 'ap-hud' }, [rec, track, time, stop]);
  apState.ui = { hud, rec, line, time, segs, stop };
  apLayer.append(hud);
}

function apCaptionNode() {
  if (!apState.ui.caption) {
    const tag = el('small', { class: 'ap-cap-tag' });
    const title = el('b', { class: 'ap-cap-title' });
    const detail = el('p', { class: 'ap-cap-detail' });
    const nextLabel = el('i', { class: 'ap-cap-next-label', text: '다음' });
    const nextTitle = el('span', { class: 'ap-cap-next-title' });
    const next = el('div', { class: 'ap-cap-next' }, [nextLabel, nextTitle]);
    const node = el('div', { class: 'ap-caption', role: 'status', 'aria-live': 'polite' }, [tag, title, detail, next]);
    apState.ui.caption = { node, tag, title, detail, next, nextTitle };
    apLayer.append(node);
  }
  return apState.ui.caption;
}

function apChipsNode() {
  if (!apState.ui.chips) {
    apState.ui.chips = el('div', { class: 'ap-chips' });
    apLayer.append(apState.ui.chips);
  }
  return apState.ui.chips;
}

function apClearSpots() {
  for (const node of apState.spots) node.classList.remove('ap-spot', 'ap-spot-code');
  apState.spots = [];
}

function apSpot(node, cls = 'ap-spot', holdMs = 2400) {
  if (!node) return;
  node.classList.add(cls);
  apState.spots.push(node);
  setTimeout(() => node.classList.remove(cls), holdMs);
}

function apTeardown() {
  document.body.classList.remove('autopilot');
  apClearSpots();
  for (const key of ['hud', 'chips', 'finale']) {
    apState.ui[key]?.remove?.();
    if (apState.ui[key]?.node) apState.ui[key].node.remove();
  }
  apState.ui.caption?.node.remove();
  apState.ui = {};
  apState.ledgerItems.clear();
  apState.attackReport = null;
  apState.blocked = 0;
  setTamperVisual('idle');
  apStartBtn.disabled = false;
}

const apDriver = {
  begin() {
    document.body.classList.add('autopilot');
    apStartBtn.disabled = true;
    sim.reset();
    ledger.replaceChildren();
    ledgerCount.textContent = '0건';
    lastResult.hidden = true;
    attackGrid.replaceChildren();
    attackSummary.hidden = true;
    dashboardEvents = () => sim.events;
    setTamperVisual('idle');
    tamperBtn.disabled = true;
    apState.ledgerItems.clear();
    apState.attackReport = null;
    apState.blocked = 0;
    refreshMetricsAndDashboard();
    apBuildHud();
    apCaptionNode();
    apChipsNode();
    globalThis.scrollTo({ top: 0, behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
  },

  caption({ act, title, detail }, step) {
    const cap = apCaptionNode();
    cap.node.setAttribute('data-act', String(act));
    cap.tag.textContent = `${act}막 · ${AUTOPILOT_ACTS.find((a) => a.n === act)?.label ?? ''}`;
    cap.title.textContent = title;
    cap.detail.textContent = detail;
    const upcoming = nextCaptionAfter(AUTOPILOT_TIMELINE, step?.at ?? 0);
    cap.next.hidden = !upcoming;
    cap.nextTitle.textContent = upcoming ? upcoming.title : '';
    cap.node.classList.remove('swap');
    void cap.node.offsetWidth;
    cap.node.classList.add('swap');
  },

  chip({ text, tone = 'info' }) {
    const chips = apChipsNode();
    const chip = el('span', { class: `ap-chip tone-${tone}`, text });
    chips.append(chip);
    while (chips.children.length > 4) chips.firstElementChild.remove();
    setTimeout(() => {
      chip.classList.add('out');
      setTimeout(() => chip.remove(), 380);
    }, 5200);
  },

  highlight({ target }) {
    apSpot(document.querySelector(target));
  },

  scrollTo({ target }) {
    document.querySelector(target)?.scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'start' });
  },

  async submitStep({ citizenId, programId }) {
    const result = await submit(citizenId, programId);
    const item = ledger.firstElementChild;
    if (result.status === 'accepted' && item) {
      apState.ledgerItems.set(`${citizenId}:${programId}`, item);
    }
    if (item) apSpot(item, 'ap-spot', 1600);
  },

  compareNullifiers() {
    const a = apState.ledgerItems.get('citizen-a-private-id:osscontest-2026');
    const b = apState.ledgerItems.get('citizen-a-private-id:scholarship-2026');
    for (const item of [a, b]) apSpot(item?.querySelector('code'), 'ap-spot-code', 4200);
  },

  prepareAttacks() {
    buildAttackPlaceholders(12);
    attackSummary.hidden = false;
    attackScore.textContent = '0 / 12';
    apState.blocked = 0;
    apState.attackReport = runAttackCorpus();
  },

  async revealAttack({ index }) {
    const report = await apState.attackReport;
    if (!report) return;
    const result = report.results[index];
    fillAttackCard(index, result);
    if (result.blocked) apState.blocked += 1;
    attackScore.textContent = `${apState.blocked} / ${report.total}`;
  },

  tamper({ phase }) {
    if (phase === 'inject') {
      setTamperVisual('playing');
      applyTamperView(true);
    } else {
      setTamperVisual('recovering');
      applyTamperView(false);
      setTimeout(() => {
        setTamperVisual('idle');
        if (document.body.classList.contains('autopilot')) tamperBtn.disabled = true;
      }, 2000);
    }
  },

  finale() {
    const metrics = sim.metrics();
    const proofs = auditProofsFor(sim.events);
    const stats = [
      { value: String(metrics.acceptedClaims), label: '수리된 신청' },
      { value: String(metrics.duplicateAttempts), label: '차단된 중복' },
      { value: `${apState.blocked} / 12`, label: '공격 차단' },
      { value: `${proofs.index.score}`, label: `CII · ${proofs.index.grade}` },
      { value: proofs.replay.match ? 'MATCH' : 'DIVERGED', label: 'Replay-Verify' },
      { value: '0', label: '온체인 개인정보 필드' }
    ];
    const card = el('div', { class: 'ap-finale-card' }, [
      el('p', { class: 'eyebrow', text: 'CivicProof Ledger · 오토파일럿 시연' }),
      el('h3', { text: '160초 검증 요약' }),
      el(
        'div',
        { class: 'ap-finale-grid' },
        stats.map((s) => el('div', { class: 'ap-stat' }, [el('span', { text: s.value }), el('small', { text: s.label })]))
      ),
      el('p', {
        class: 'ap-finale-note',
        text: '방금 본 모든 판정은 브라우저에서 실행된 결정적 코드의 결과이며, 이 시연 타임라인 자체도 자동 테스트로 검증됩니다.'
      }),
      el('p', { class: 'ap-finale-repo', text: 'github.com/leeminsuk/civicproof-ledger · Apache-2.0' })
    ]);
    const overlay = el('div', { class: 'ap-finale' }, [card]);
    overlay.addEventListener('click', () => {
      if (!apRunner?.isRunning()) apTeardown();
    });
    apState.ui.finale = overlay;
    apLayer.append(overlay);
  },

  progress({ elapsed, total, fraction, act }) {
    const { line, time, segs } = apState.ui;
    if (!line) return;
    line.style.width = `${(fraction * 100).toFixed(2)}%`;
    time.textContent = `${apFmt(elapsed)} / ${apFmt(total)}`;
    for (const seg of segs) seg.classList.toggle('active', seg.getAttribute('data-act') === String(act));
  },

  end() {
    const { rec, stop, caption } = apState.ui;
    document.body.classList.remove('autopilot');
    rec?.classList.add('done');
    rec?.replaceChildren(el('span', { text: '✓ 시연 완료' }));
    if (stop) stop.textContent = '닫기';
    caption?.node.classList.add('fade-out');
    setTimeout(() => caption?.node.remove(), 900);
    setTamperVisual('idle');
    apStartBtn.disabled = false;
  },

  cleanup() {
    applyTamperView(false);
    apTeardown();
  }
};

apStartBtn.addEventListener('click', () => {
  if (apRunner?.isRunning()) return;
  apTeardown();
  apRunner = createAutopilot({
    driver: apDriver,
    speed: AP_SPEED,
    onError: (err) => console.error('[autopilot]', err.action, err.message)
  });
  apRunner.start();
});

globalThis.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (apRunner?.isRunning()) apRunner.stop();
  else if (apState.ui.hud) apTeardown();
});

// ── boot ──
buildBoard();
refreshMetricsAndDashboard();
