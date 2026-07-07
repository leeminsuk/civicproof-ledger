// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';

const engine = await import('../web/demoEngine.js');
const {
  SCRIPTED_SCENARIO,
  auditProofsFor,
  createSimulator,
  perProgramPressure,
  programLabel,
  runAttackCorpus,
  tamperEvents
} = engine;

describe('interactive ledger simulator', () => {
  it('accepts a first application and blocks a same-program repeat', async () => {
    const sim = createSimulator();
    const first = await sim.submit('citizen-a-private-id', 'osscontest-2026');
    const repeat = await sim.submit('citizen-a-private-id', 'osscontest-2026');

    expect(first.status).toBe('accepted');
    expect(first.signatureValid).toBe(true);
    expect(repeat.status).toBe('duplicate');
    expect(sim.metrics()).toEqual({ acceptedClaims: 1, duplicateAttempts: 1, programs: 1, piiFieldsStored: 0 });
  });

  it('keeps the same citizen unlinkable across programs (different nullifiers)', async () => {
    const sim = createSimulator();
    const oss = await sim.submit('citizen-a-private-id', 'osscontest-2026');
    const scholarship = await sim.submit('citizen-a-private-id', 'scholarship-2026');

    expect(oss.status).toBe('accepted');
    expect(scholarship.status).toBe('accepted');
    expect(oss.nullifierHash).not.toBe(scholarship.nullifierHash);
  });

  it('runs the scripted scenario to 4 accepted / 1 duplicate / 3 programs, CII 100', async () => {
    const sim = createSimulator();
    for (const step of SCRIPTED_SCENARIO) {
      await sim.submit(step.citizenId, step.programId);
    }
    const { metrics, replay, index } = sim.auditProofs();

    expect(metrics.acceptedClaims).toBe(4);
    expect(metrics.duplicateAttempts).toBe(1);
    expect(metrics.programs).toBe(3);
    expect(replay.match).toBe(true);
    expect(index.score).toBe(100);
    expect(index.grade).toBe('EXCELLENT');
  });

  it('exposes per-program duplicate pressure', async () => {
    const sim = createSimulator();
    await sim.submit('citizen-a-private-id', 'osscontest-2026');
    await sim.submit('citizen-a-private-id', 'osscontest-2026');
    const pressure = perProgramPressure(sim.events);
    const oss = pressure.find((p) => p.programId === 'osscontest-2026');

    expect(oss).toMatchObject({ accepted: 1, duplicates: 1, pressure: 50 });
    expect(programLabel('osscontest-2026')).toBe('오픈소스 공모전');
  });
});

describe('live red-team attack corpus (browser)', () => {
  it('blocks 100% of the 12 attacks with all five categories', async () => {
    const report = await runAttackCorpus();

    const leaked = report.results.filter((r) => !r.blocked);
    expect(leaked, `leaked: ${leaked.map((r) => r.id).join(', ')}`).toEqual([]);
    expect(report.total).toBe(12);
    expect(report.allBlocked).toBe(true);
    expect(new Set(report.results.map((r) => r.category))).toEqual(
      new Set(['credential', 'ledger', 'proof', 'audit-log', 'privacy'])
    );
  });
});

describe('audit-log tamper injection', () => {
  it('drops the integrity index from 100 to a WATCH grade when the log is forged', async () => {
    const sim = createSimulator();
    for (const step of SCRIPTED_SCENARIO) {
      await sim.submit(step.citizenId, step.programId);
    }
    const healthy = sim.auditProofs();
    expect(healthy.index.score).toBe(100);

    const forged = auditProofsFor(tamperEvents(sim.events));
    expect(forged.replay.match).toBe(false);
    expect(forged.index.score).toBeLessThan(100);
    expect(forged.index.subscores.auditConsistency).toBe(0);
    expect(['WATCH', 'ALERT']).toContain(forged.index.grade);
  });

  // Models the one-shot tamper-demo button: clean -> inject forgery -> auto-recover.
  // The button drives exactly these three auditProofsFor() states in sequence.
  it('recovers to a clean 100/MATCH state after the forged event is removed', async () => {
    const sim = createSimulator();
    for (const step of SCRIPTED_SCENARIO) {
      await sim.submit(step.citizenId, step.programId);
    }

    const before = auditProofsFor(sim.events);
    expect(before.index.score).toBe(100);
    expect(before.replay.match).toBe(true);

    const tampered = auditProofsFor(tamperEvents(sim.events));
    expect(tampered.replay.match).toBe(false);
    expect(tampered.index.grade).toBe('WATCH');

    // Recovery re-reads sim.events (never the tampered copy), so state returns intact.
    const after = auditProofsFor(sim.events);
    expect(after.index.score).toBe(100);
    expect(after.index.grade).toBe('EXCELLENT');
    expect(after.replay.match).toBe(true);
    expect(after.metrics).toEqual(before.metrics);
  });

  // The button is usable standalone (no scenario played): this is the exact
  // empty-ledger transition shown in the dashboard screenshots (100 -> 60 -> 100).
  it('produces the 100 -> 60 WATCH -> 100 transition on an empty ledger', () => {
    const sim = createSimulator();

    const clean = auditProofsFor(sim.events);
    expect(clean.index.score).toBe(100);
    expect(clean.index.grade).toBe('EXCELLENT');
    expect(clean.perProgram).toEqual([]);

    const forged = auditProofsFor(tamperEvents(sim.events));
    expect(forged.index.score).toBe(60);
    expect(forged.index.grade).toBe('WATCH');
    expect(forged.replay.match).toBe(false);
    expect(forged.replay.orderViolations.some((key) => key.includes('ghost-program'))).toBe(true);
    expect(forged.perProgram.some((row) => row.programId === 'ghost-program')).toBe(true);

    const recovered = auditProofsFor(sim.events);
    expect(recovered.index.score).toBe(100);
    expect(recovered.perProgram).toEqual([]);
  });
});
