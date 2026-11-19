import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 8790);

// UI tests in mock mode (section 13). The harness runs the real Worker module over dist/client.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1, // the harness env is shared and mutable
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    permissions: ['clipboard-read', 'clipboard-write'],
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node tests/e2e/server.mjs`,
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/api/estado`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
