// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'web/demoEngine.js', 'web/proofs.js', 'web/verifier.js'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        statements: 85,
        branches: 72,
        functions: 85,
        lines: 85
      }
    }
  }
});
