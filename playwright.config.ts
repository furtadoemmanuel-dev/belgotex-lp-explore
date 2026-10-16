import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 45_000,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { baseURL: 'http://127.0.0.1:4324', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: {
    command: 'npx astro preview --port 4324 --host 127.0.0.1',
    url: 'http://127.0.0.1:4324',
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'mobile-390',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 390, height: 844 },
        hasTouch: true,
      },
    },
    {
      name: 'tablet-768',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'desktop-1280',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1280, height: 900 } },
    },
  ],
});
