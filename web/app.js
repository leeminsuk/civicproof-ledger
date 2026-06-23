import { demoIssuer, demoScenario, verifyCredentialPaste } from './verifier.js';

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
const timeline = document.querySelector('#timeline');

async function boot() {
  const scenario = await demoScenario();
  credentialInput.value = scenario.sampleCredentialJson;
  renderMetrics(scenario.metrics);
  renderTimeline(scenario.events);
  renderResult({ status: 'normal', message: 'Paste a credential or load the demo scenario.' });

  loadDemoButton.addEventListener('click', async () => {
    const next = await demoScenario();
    state.seenNullifiers = new Set();
    credentialInput.value = next.sampleCredentialJson;
    renderMetrics(next.metrics);
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
