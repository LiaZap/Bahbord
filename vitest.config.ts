import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // e2e/ é Playwright (rodar via `npm run e2e`), não vitest
    exclude: ['node_modules', 'dist', '.next', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['lib/**/*.ts', 'app/api/**/*.ts'],
      exclude: [
        'lib/db.ts', // pool é integration, não unit
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/types.ts',
      ],
      // Threshold inicial conservador — sobe gradualmente
      thresholds: {
        lines: 15,
        functions: 20,
        branches: 50,
        statements: 15,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
