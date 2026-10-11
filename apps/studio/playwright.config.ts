import { defineConfig, devices } from '@playwright/test';

const apiUrl = process.env.VITE_CREATOR_API_URL ?? 'http://127.0.0.1:3010';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'on-first-retry',
    locale: 'ru-RU',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'pnpm --dir ../creator-api run start:dev',
      url: `${apiUrl}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      env: { NODE_ENV: 'development', CREATOR_DEV_AUTH: 'true' },
      timeout: 60_000,
    },
    {
      command: 'pnpm exec vite --host 127.0.0.1 --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: !process.env.CI,
      env: { VITE_CREATOR_API_URL: apiUrl },
    },
  ],
});
