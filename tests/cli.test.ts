// SPDX-License-Identifier: Apache-2.0
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  auditUnexpectedFields,
  buildProgram,
  demoCommitment,
  findOrderViolations,
  issueDemoCredential,
  loadScenario,
  parseScenario,
  replayScenario,
  scoreScenario,
  verifyCredentialFile
} from '../src/cli.js';
import { replayAuditEvents } from '../src/replay.js';
import type { AuditEvent } from '../src/ledger.js';

const cleanPath = fileURLToPath(new URL('../examples/scenario-clean.json', import.meta.url));
const tamperedPath = fileURLToPath(new URL('../examples/scenario-tampered.json', import.meta.url));

describe('cli scenario parsing', () => {
  it('accepts both a bare event array and a scenario object', () => {
    const fromObject = loadScenario(cleanPath);
    const fromArray = parseScenario(JSON.stringify(fromObject.events));
    expect(fromObject.events).toHaveLength(3);
    expect(fromArray.events).toEqual(fromObject.events);
    expect(fromObject.credentialChecks).toEqual({ total: 3, validSignatures: 3 });
  });

  it('rejects malformed scenario files with actionable errors', () => {
    expect(() => parseScenario('not json')).toThrow(/valid JSON/);
    expect(() => parseScenario('42')).toThrow(/"events" array/);
    expect(() => parseScenario('{"events":[{"event":"Nope"}]}')).toThrow(/events\[0\]\.event/);
    expect(() => parseScenario('{"events":[{"event":"ClaimRegistered","programId":"p","nullifierHash":"0xa","commitmentHash":"0xb","metadataUri":"u","timestamp":"t","accepted":"yes"}]}')).toThrow(
      /events\[0\]\.accepted/
    );
  });
});

describe('cli replay on example fixtures', () => {
  it('replays the clean fixture consistently and reproduces the deterministic state root', () => {
    const scenario = loadScenario(cleanPath);
    const report = replayScenario(scenario);
    expect(report.consistent).toBe(true);
    expect(report.totalClaims).toBe(2);
    expect(report.duplicateAttempts).toBe(1);
    expect(report.programs).toBe(2);
    expect(report.orderViolations).toEqual([]);
    expect(report.stateRoot).toBe(replayAuditEvents(scenario.events).stateRoot);
  });

  it('flags the forged duplicate event in the tampered fixture', () => {
    const scenario = loadScenario(tamperedPath);
    const report = replayScenario(scenario);
    expect(report.consistent).toBe(false);
    expect(report.orderViolations).toHaveLength(1);
    expect(report.orderViolations[0]).toContain('ghost-program-2026');
    expect(findOrderViolations(scenario.events)).toEqual(report.orderViolations);
  });
});

describe('cli civic integrity index', () => {
  it('scores the clean fixture 100/100 EXCELLENT', () => {
    const index = scoreScenario(loadScenario(cleanPath));
    expect(index.score).toBe(100);
    expect(index.grade).toBe('EXCELLENT');
  });

  it('drops the tampered fixture to 60/100 WATCH with a zero audit subscore', () => {
    const index = scoreScenario(loadScenario(tamperedPath));
    expect(index.score).toBe(60);
    expect(index.grade).toBe('WATCH');
    expect(index.subscores.auditConsistency).toBe(0);
  });
});

describe('cli privacy lint', () => {
  it('flags unexpected fields on public audit events and zeroes the privacy subscore', () => {
    const events = loadScenario(cleanPath).events.map((event) => ({ ...event }));
    (events[0] as AuditEvent & { email?: string }).email = 'alice@example.com';
    expect(auditUnexpectedFields(events)).toEqual(['event[0].email']);
    const index = scoreScenario({ events });
    expect(index.subscores.privacyMinimization).toBe(0);
  });
});

describe('cli credential round-trip', () => {
  it('issues and verifies a demo credential through files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'civicproof-cli-'));
    const credential = await issueDemoCredential({
      program: 'osscontest-2026',
      subject: 'alice-private-id',
      salt: 'agency-secret'
    });
    const filePath = join(dir, 'credential.json');
    writeFileSync(filePath, JSON.stringify(credential, null, 2));

    const { verification } = await verifyCredentialFile(filePath, { at: new Date('2026-07-01T00:00:00.000Z') });
    expect(verification).toEqual({ valid: true });
  });

  it('rejects a tampered credential file as TAMPERED', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'civicproof-cli-'));
    const credential = await issueDemoCredential({
      program: 'osscontest-2026',
      subject: 'alice-private-id',
      salt: 'agency-secret'
    });
    credential.credentialSubject.commitmentHash = demoCommitment('other-program', 'mallory', 'other-salt');
    const filePath = join(dir, 'tampered.json');
    writeFileSync(filePath, JSON.stringify(credential, null, 2));

    const { verification } = await verifyCredentialFile(filePath, { at: new Date('2026-07-01T00:00:00.000Z') });
    expect(verification).toEqual({ valid: false, reason: 'TAMPERED' });
  });
});

describe('cli command surface', () => {
  it('registers the issue/verify/replay/cii/demo/redteam subcommands', () => {
    const names = buildProgram().commands.map((command) => command.name());
    expect(names).toEqual(expect.arrayContaining(['issue', 'verify', 'replay', 'cii', 'demo', 'redteam']));
  });

  it('executes replay and cii actions, setting exit code 1 on tampered logs', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await buildProgram().parseAsync(['replay', tamperedPath], { from: 'user' });
      expect(process.exitCode).toBe(1);
      process.exitCode = 0;
      let output = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(output).toContain('REPLAY DIVERGED');

      logSpy.mockClear();
      await buildProgram().parseAsync(['replay', cleanPath, '--json'], { from: 'user' });
      expect(JSON.parse(logSpy.mock.calls[0][0] as string).consistent).toBe(true);

      logSpy.mockClear();
      await buildProgram().parseAsync(['cii', cleanPath], { from: 'user' });
      output = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(output).toContain('100/100 EXCELLENT');
    } finally {
      logSpy.mockRestore();
      process.exitCode = 0;
    }
  });

  it('executes issue then verify actions against a credential file', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await buildProgram().parseAsync(['issue', '--program', 'osscontest-2026', '--subject', 'alice'], { from: 'user' });
      const credentialJson = logSpy.mock.calls[0][0] as string;
      expect(JSON.parse(credentialJson).proof.proofValue).toMatch(/^[0-9a-f]{128}$/);

      const dir = mkdtempSync(join(tmpdir(), 'civicproof-cli-'));
      const filePath = join(dir, 'issued.json');
      writeFileSync(filePath, credentialJson);

      logSpy.mockClear();
      await buildProgram().parseAsync(['verify', filePath, '--json', '--at', '2026-07-01T00:00:00.000Z'], { from: 'user' });
      expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toEqual({ valid: true });
      expect(process.exitCode ?? 0).toBe(0);
    } finally {
      logSpy.mockRestore();
      process.exitCode = 0;
    }
  });

  it('executes demo and redteam actions with healthy verdicts', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await buildProgram().parseAsync(['demo'], { from: 'user' });
      let output = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(output).toContain('Civic Integrity Index: 100/100 EXCELLENT');

      logSpy.mockClear();
      await buildProgram().parseAsync(['redteam'], { from: 'user' });
      output = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(output).toContain('Blocked 12/12 attacks');
      expect(process.exitCode ?? 0).toBe(0);
    } finally {
      logSpy.mockRestore();
      process.exitCode = 0;
    }
  });
});
