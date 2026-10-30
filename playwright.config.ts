import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4000',
    trace: 'off',
    channel: 'chrome',
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
    {
      name: 'Mobile Viewport (390px)',
      use: {
        viewport: { width: 390, height: 844 },
        channel: 'chrome',
      },
    },
  ],
  webServer: {
    command: 'npx tsx apps/api/src/server.ts',
    url: 'http://127.0.0.1:4000/api/health',
    reuseExistingServer: true,
    timeout: 30000,
    env: {
      PORT: '4000',
      HOST: '127.0.0.1',
      NODE_ENV: 'development',
      YOUCAM_PROVIDER_MODE: 'DEMO_FIXTURE',
      ENCRYPTION_KEY_HEX: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      DATABASE_DRIVER: 'pglite',
    },
  },
});
