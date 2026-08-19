// SPDX-License-Identifier: Apache-2.0

export const AUTOPILOT_TOTAL_MS: number;
export const AUTOPILOT_TICK_MS: number;

export interface AutopilotAct {
  n: number;
  label: string;
  from: number;
  to: number;
}
export const AUTOPILOT_ACTS: AutopilotAct[];
export const AUTOPILOT_ACTIONS: string[];

export interface AutopilotStep {
  at: number;
  action: string;
  params: Record<string, unknown>;
}
export const AUTOPILOT_TIMELINE: AutopilotStep[];

export function actAt(ms: number): number;

export interface UpcomingCaption {
  at: number;
  act: number;
  title: string;
}
export function nextCaptionAfter(timeline: AutopilotStep[], ms: number): UpcomingCaption | null;

export interface TimelineValidation {
  ok: boolean;
  errors: string[];
}
export function validateTimeline(steps: AutopilotStep[]): TimelineValidation;

export interface AutopilotProgress {
  elapsed: number;
  total: number;
  fraction: number;
  act: number;
}
export interface AutopilotError {
  action: string;
  at: number;
  message: string;
}
export interface AutopilotFinish {
  reason: string;
  errors: AutopilotError[];
}

export interface AutopilotDriver {
  progress?(progress: AutopilotProgress): void;
  end?(finish: AutopilotFinish): void;
  cleanup?(finish: AutopilotFinish): void;
  [action: string]: ((params?: never, step?: never) => unknown) | undefined;
}

export interface AutopilotClock {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

export interface AutopilotOptions {
  driver: object;
  timeline?: AutopilotStep[];
  speed?: number;
  clock?: AutopilotClock;
  onFinish?(finish: AutopilotFinish): void;
  onError?(error: AutopilotError): void;
}

export interface AutopilotRunner {
  start(): boolean;
  stop(): boolean;
  isRunning(): boolean;
  getErrors(): AutopilotError[];
}

export function createAutopilot(options?: AutopilotOptions): AutopilotRunner;
