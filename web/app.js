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
}

function renderLedgerItem(result) {
  const item = el('li', { class: `ledger-item ${result.status}` }, [
    el('span', { class: 'ev-tag', text: result.status === 'accepted' ? '수리' : '중복차단' }),
    el('span', { class: 'ev-mid' }, [
      el('span', { text: `${result.citizenLabel} · ${result.programLabel}` }),
      el('small', { text: result.status === 'accepted' ? '최초 등록됨' : '이미 등록된 널리파이어' })
    ]),
    el('code', { text: shortHex(result.nullifierHash) })
  ]);
  ledger.prepend(item);
  ledgerCount.textContent = `${sim.events.length}건`;
}

function showLastResult(result) {
  lastResult.hidden = false;
  const badge = lastResult.querySelector('.lr-badge');
  badge.className = `lr-badge ${result.status}`;
  badge.textContent = result.status === 'accepted' ? 'ACCEPTED' : 'DUPLICATE';
  lastResult.querySelector('.lr-text').textContent =
    result.status === 'accepted'
      ? `서명 검증 통과 · 프로그램별 널리파이어 신규 등록`
      : `서명은 유효하나 같은 사업의 널리파이어가 이미 존재 → 차단`;
  lastResult.querySelector('.lr-nullifier').textContent = shortHex(result.nullifierHash, 14, 8);
}

$('#reset-sim').addEventListener('click', () => {
  sim.reset();
  ledger.replaceChildren();
  ledgerCount.textContent = '0건';
  lastResult.hidden = true;
  $('#tamper-switch').checked = false;
  refreshMetricsAndDashboard();
});

$('#play-scenario').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  sim.reset();
  ledger.replaceChildren();
  $('#tamper-switch').checked = false;
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

$('#tamper-switch').addEventListener('change', (event) => {
  dashboardEvents = event.currentTarget.checked ? () => tamperEvents(sim.events) : () => sim.events;
  renderDashboard();
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── boot ──
buildBoard();
refreshMetricsAndDashboard();
