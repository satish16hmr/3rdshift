import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30_000,
  retries: 1,
  workers: 1, // serial — avoids session conflicts
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://3rdshift.ai',
    extraHTTPHeaders: {
      // tell the app this is an automated check
      'User-Agent': '3rdshift-smoke-test/1.0',
    },
    // screenshot on failure only
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
