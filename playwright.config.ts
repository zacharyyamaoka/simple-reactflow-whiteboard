import { defineConfig, devices } from '@playwright/test'

/**
 * Acceptance runs against the REAL dev server, not a mock. A component test
 * that renders our own DOM would assume the React Flow integration already
 * works — which is exactly the seam these tests exist to prove.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5199',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
