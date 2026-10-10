import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{spec,test}.ts', 'src/**/*.{spec,test}.tsx'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
