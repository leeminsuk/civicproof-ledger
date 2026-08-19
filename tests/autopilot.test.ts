// SPDX-License-Identifier: Apache-2.0
// The 160-second autopilot demo is itself a verified artifact: these tests pin
// the timeline invariants (so the on-screen story cannot silently drift from
// the engines) and drive the executor against a virtual clock (so pacing,
// stopping and error resilience are provable without a browser).
import { describe, expect, it } from 'vitest';

const autopilot = await import('../web/autopilot.js');
const engine = await import('../web/demoEngine.js');

const {
  AUTOPILOT_ACTS,
  AUTOPILOT_ACTIONS,
  AUTOPILOT_TIMELINE,
  AUTOPILOT_TOTAL_MS,
  actAt,
  createAutopilot,
  validateTimeline
} = autopilot;
const { SCRIPTED_SCENARIO } = engine;

type Step = { at: number; action: string; params: Record<string, unknown> };
const timeline = AUTOPILOT_TIMELINE as Step[];
const byAction = (name: string) => timeline.filter((s) => s.action === name);
const cloneTimeline = () => structuredClone(timeline);

function createVirtualClock() {
  let now = 0;
  let seq = 0;
  let nextId = 1;
  const tasks: { time: number; seq: number; fn: () => void; id: number }[] = [];
  return {
    clock: {
      setTimeout(fn: () => void, ms: number) {
        const id = nextId++;
        tasks.push({ time: now + ms, seq: seq++, fn, id });
        return id;
      },
      clearTimeout(id: number) {
        const index = tasks.findIndex((t) => t.id === id);
        if (index >= 0) tasks.splice(index, 1);
      }
    },
    advance(ms: number) {
      const target = now + ms;
      for (;;) {
        tasks.sort((a, b) => a.time - b.time || a.seq - b.seq);
        const next = tasks[0];
        if (!next || next.time > target) break;
        tasks.shift();
        now = next.time;
        next.fn();
      }
      now = target;
    },
    pending: () => tasks.length
  };
}

function createRecordingDriver(overrides: Record<string, (params?: unknown) => unknown> = {}) {
  const calls: { action: string; params?: unknown }[] = [];
  const progress: { elapsed: number; fraction: number; act: number }[] = [];
  const handler = (action: string) =>
    (params?: unknown) => {
      calls.push({ action, params });
      return overrides[action]?.(params);
    };
  const driver: Record<string, unknown> = {
    progress: (p: { elapsed: number; fraction: number; act: number }) => progress.push(p)
  };
  for (const action of [...AUTOPILOT_ACTIONS, 'cleanup']) driver[action] = handler(action);
  return { driver, calls, progress };
}

describe('autopilot timeline invariants', () => {
  it('passes its own validator with zero errors', () => {
    const result = validateTimeline(timeline);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('runs exactly 160 seconds, opening with begin and closing with end', () => {
    expect(timeline[0]).toMatchObject({ at: 0, action: 'begin' });
    expect(timeline[timeline.length - 1]).toMatchObject({ at: 160_000, action: 'end' });
    expect(AUTOPILOT_TOTAL_MS).toBe(160_000);
  });

  it('keeps act windows contiguous and covering the full 160 seconds', () => {
    expect(AUTOPILOT_ACTS[0].from).toBe(0);
    expect(AUTOPILOT_ACTS[AUTOPILOT_ACTS.length - 1].to).toBe(AUTOPILOT_TOTAL_MS);
    for (let i = 1; i < AUTOPILOT_ACTS.length; i++) {
      expect(AUTOPILOT_ACTS[i].from).toBe(AUTOPILOT_ACTS[i - 1].to);
    }
    expect(actAt(0)).toBe(1);
    expect(actAt(100_000)).toBe(3);
    expect(actAt(AUTOPILOT_TOTAL_MS)).toBe(4);
  });

  it('mirrors the scripted scenario one-to-one (no drift from demoEngine)', () => {
    const submits = byAction('submitStep').map((s) => ({
      citizenId: s.params.citizenId,
      programId: s.params.programId
    }));
    expect(submits).toEqual(
      SCRIPTED_SCENARIO.map((s: { citizenId: string; programId: string }) => ({
        citizenId: s.citizenId,
        programId: s.programId
      }))
    );
  });

  it('reveals all 12 red-team attacks in order, after preparation', () => {
    const prepareAt = byAction('prepareAttacks')[0].at;
    const reveals = byAction('revealAttack');
    expect(reveals.map((s) => s.params.index)).toEqual([...Array(12).keys()]);
    for (const reveal of reveals) expect(reveal.at).toBeGreaterThan(prepareAt);
  });

  it('injects the tamper before recovering, both inside act 4', () => {
    const [inject, recover] = ['inject', 'recover'].map(
      (phase) => byAction('tamper').find((s) => s.params.phase === phase)!
    );
    expect(inject.at).toBeLessThan(recover.at);
    for (const s of [inject, recover]) {
      expect(s.at).toBeGreaterThanOrEqual(AUTOPILOT_ACTS[3].from);
      expect(s.at).toBeLessThan(AUTOPILOT_ACTS[3].to);
    }
  });

  it('narrates generously: 20+ captions, every one with a substantive detail', () => {
    const captions = byAction('caption');
    expect(captions.length).toBeGreaterThanOrEqual(20);
    for (const caption of captions) {
      expect(String(caption.params.title).trim().length).toBeGreaterThan(0);
      expect(String(caption.params.detail).trim().length).toBeGreaterThanOrEqual(15);
    }
  });

  it('schedules the finale in the last 10 seconds', () => {
    expect(byAction('finale')[0].at).toBeGreaterThanOrEqual(150_000);
  });

  it('always knows what comes next (coming-up preview for the subtitle panel)', () => {
    const { nextCaptionAfter } = autopilot;
    const captions = byAction('caption');
    expect(nextCaptionAfter(timeline, 0)).toMatchObject({ at: captions[0].at });
    expect(nextCaptionAfter(timeline, captions[0].at)).toMatchObject({ at: captions[1].at });
    for (let i = 0; i < captions.length - 1; i++) {
      expect(nextCaptionAfter(timeline, captions[i].at)!.at).toBe(captions[i + 1].at);
    }
    expect(nextCaptionAfter(timeline, captions[captions.length - 1].at)).toBeNull();
  });
});

describe('timeline validator rejects broken timelines', () => {
  it('rejects an unsorted timeline', () => {
    const broken = cloneTimeline();
    [broken[3], broken[10]] = [broken[10], broken[3]];
    expect(validateTimeline(broken).ok).toBe(false);
  });

  it('rejects unknown actions and empty captions', () => {
    const unknown = cloneTimeline();
    unknown[5] = { ...unknown[5], action: 'teleport' };
    expect(validateTimeline(unknown).ok).toBe(false);

    const empty = cloneTimeline();
    const captionIndex = empty.findIndex((s) => s.action === 'caption');
    empty[captionIndex] = { ...empty[captionIndex], params: { act: 1, title: ' ', detail: 'x' } };
    expect(validateTimeline(empty).ok).toBe(false);
  });

  it('rejects a timeline that does not end at exactly 160s', () => {
    const short = cloneTimeline();
    short[short.length - 1] = { ...short[short.length - 1], at: 159_000 };
    expect(validateTimeline(short).ok).toBe(false);
  });

  it('rejects missing attack coverage and inverted tamper phases', () => {
    const missing = cloneTimeline().filter(
      (s) => !(s.action === 'revealAttack' && s.params.index === 7)
    );
    expect(validateTimeline(missing).ok).toBe(false);

    const inverted = cloneTimeline().map((s) =>
      s.action === 'tamper'
        ? { ...s, params: { phase: s.params.phase === 'inject' ? 'recover' : 'inject' } }
        : s
    );
    expect(validateTimeline(inverted).ok).toBe(false);
  });
});

describe('autopilot executor (virtual clock)', () => {
  it('fires every step in timeline order and finishes at 160s', () => {
    const { clock, advance } = createVirtualClock();
    const { driver, calls, progress } = createRecordingDriver();
    let finished: { reason: string } | null = null;
    const runner = createAutopilot({ driver, clock, onFinish: (f: { reason: string }) => (finished = f) });

    expect(runner.start()).toBe(true);
    advance(AUTOPILOT_TOTAL_MS);

    expect(calls.map((c) => c.action)).toEqual(timeline.map((s) => s.action));
    expect(finished).toMatchObject({ reason: 'completed', errors: [] });
    expect(runner.isRunning()).toBe(false);
    expect(progress[progress.length - 1].fraction).toBe(1);
    expect(progress.some((p) => p.act === 2)).toBe(true);
    expect(progress.some((p) => p.act === 3)).toBe(true);
  });

  it('compresses wall-clock time by the speed factor without reordering', () => {
    const { clock, advance } = createVirtualClock();
    const { driver, calls } = createRecordingDriver();
    let finished = false;
    const runner = createAutopilot({ driver, clock, speed: 20, onFinish: () => (finished = true) });

    runner.start();
    advance(AUTOPILOT_TOTAL_MS / 20);

    expect(finished).toBe(true);
    expect(calls.map((c) => c.action)).toEqual(timeline.map((s) => s.action));
  });

  it('stop() cancels everything pending and calls cleanup exactly once', () => {
    const { clock, advance, pending } = createVirtualClock();
    const { driver, calls } = createRecordingDriver();
    const runner = createAutopilot({ driver, clock });

    runner.start();
    advance(5_000);
    const firedBeforeStop = calls.length;
    expect(runner.stop()).toBe(true);

    const cleanups = calls.filter((c) => c.action === 'cleanup');
    expect(cleanups).toHaveLength(1);
    expect(pending()).toBe(0);

    advance(AUTOPILOT_TOTAL_MS);
    expect(calls.length).toBe(firedBeforeStop + 1);
    expect(runner.stop()).toBe(false);
  });

  it('keeps running when a driver action throws, and reports the errors', () => {
    const { clock, advance } = createVirtualClock();
    const { driver, calls } = createRecordingDriver({
      submitStep: () => {
        throw new Error('boom');
      }
    });
    let finished: { errors: { action: string }[] } | null = null;
    const runner = createAutopilot({ driver, clock, onFinish: (f: never) => (finished = f) });

    runner.start();
    advance(AUTOPILOT_TOTAL_MS);

    expect(finished!.errors).toHaveLength(byAction('submitStep').length);
    expect(finished!.errors.every((e) => e.action === 'submitStep')).toBe(true);
    expect(calls.filter((c) => c.action === 'revealAttack')).toHaveLength(12);
  });

  it('collects rejected async driver actions without stopping the show', async () => {
    const { clock, advance } = createVirtualClock();
    const { driver } = createRecordingDriver({
      prepareAttacks: () => Promise.reject(new Error('corpus offline'))
    });
    const runner = createAutopilot({ driver, clock });

    runner.start();
    advance(AUTOPILOT_TOTAL_MS);
    await Promise.resolve();

    expect(runner.getErrors()).toHaveLength(1);
    expect(runner.getErrors()[0]).toMatchObject({ action: 'prepareAttacks' });
  });

  it('ignores start() while already running and refuses an invalid timeline', () => {
    const { clock } = createVirtualClock();
    const { driver } = createRecordingDriver();
    const runner = createAutopilot({ driver, clock });
    expect(runner.start()).toBe(true);
    expect(runner.start()).toBe(false);
    runner.stop();

    expect(() => createAutopilot({ driver, clock, timeline: [] })).toThrow(/invalid timeline/);
    expect(() => createAutopilot({} as never)).toThrow(/driver/);
  });
});
