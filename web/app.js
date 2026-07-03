import { computeIntegrityIndex, demoIssuer, demoScenario, replayFromEvents, verifyCredentialPaste } from './verifier.js';

const state = {
  seenNullifiers: new Set()
};

const credentialInput = document.querySelector('#credential-json');
const verifyButton = document.querySelector('#verify-button');
const loadDemoButton = document.querySelector('#load-demo-button');
const resultPanel = document.querySelector('#result-panel');
const metrics = {
  acceptedClaims: document.querySelector('#accepted-claims'),
  duplicateAttempts: document.querySelector('#duplicate-attempts'),
  programs: document.querySelector('#programs'),
  piiFieldsStored: document.querySelector('#pii-fields')
};
const integrityScore = document.querySelector('#integrity-score');
const integrityLine = document.querySelector('#integrity-line');
const replayStatus = document.querySelector('#replay-status');
const timeline = document.querySelector('#timeline');

async function boot() {
  const scenario = await demoScenario();
  credentialInput.value = scenario.sampleCredentialJson;
  renderMetrics(scenario.metrics);
  renderAuditProofs(scenario);
  renderTimeline(scenario.events);
  renderResult({ status: 'normal', message: 'Paste a credential or load the demo scenario.' });

  loadDemoButton.addEventListener('click', async () => {
    const next = await demoScenario();
    state.seenNullifiers = new Set();
    credentialInput.value = next.sampleCredentialJson;
    renderMetrics(next.metrics);
    renderAuditProofs(next);
    renderTimeline(next.events);
    renderResult({ status: 'normal', message: 'Demo credential loaded.' });
  });

  verifyButton.addEventListener('click', async () => {
    const result = await verifyCredentialPaste(credentialInput.value, {
      issuerDid: demoIssuer.did,
      publicKeyHex: demoIssuer.publicKeyHex,
      seenNullifiers: state.seenNullifiers,
      at: new Date()
    });
    renderResult(result);
  });
}

function renderMetrics(nextMetrics) {
  metrics.acceptedClaims.textContent = String(nextMetrics.acceptedClaims);
  metrics.duplicateAttempts.textContent = String(nextMetrics.duplicateAttempts);
  metrics.programs.textContent = String(nextMetrics.programs);
  metrics.piiFieldsStored.textContent = String(nextMetrics.piiFieldsStored);
}

function renderAuditProofs(scenario) {
  const replay = replayFromEvents(scenario.events, scenario.metrics);
  const index = computeIntegrityIndex(scenario.events, {
    replayMatch: replay.match,
    credentialChecks: {
      total: scenario.verifierResults.length,
      validSignatures: scenario.verifierResults.filter((entry) => entry.status !== 'tampered').length
    },
    piiFieldsOnLedger: scenario.metrics.piiFieldsStored
  });

  integrityScore.textContent = String(index.score);
  integrityLine.textContent = `Civic Integrity Index ${index.score}/100 ${index.grade} — audit ${index.subscores.auditConsistency}/40, containment ${index.subscores.duplicateContainment}/30, credential ${index.subscores.credentialIntegrity}/20, privacy ${index.subscores.privacyMinimization}/10 (cii-v1).`;
  replayStatus.textContent = replay.match
    ? `Replay verification MATCH — ${replay.derived.acceptedClaims} accepted, ${replay.derived.duplicateAttempts} duplicates re-derived from the event log alone.`
    : `Replay verification DIVERGED — ${replay.orderViolations.length} order violations detected.`;
}

function renderTimeline(events) {
  timeline.replaceChildren(...events.map((event) => {
    const item = document.createElement('li');
    item.className = event.accepted ? 'timeline-item accepted' : 'timeline-item duplicate';

    const eventName = document.createElement('span');
    eventName.textContent = event.event;
    const program = document.createElement('strong');
    program.textContent = event.programId;
    const nullifier = document.createElement('code');
    nullifier.textContent = `${event.nullifierHash.slice(0, 18)}...`;

    item.append(eventName, program, nullifier);
    return item;
  }));
}

function renderResult(result) {
  resultPanel.className = `result ${result.status}`;
  resultPanel.querySelector('strong').textContent = result.status.toUpperCase();
  resultPanel.querySelector('span').textContent = result.message;
}

boot().catch((error) => {
  renderResult({ status: 'tampered', message: error instanceof Error ? error.message : String(error) });
});
