import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    { command: 'uv run --project ../../services/api uvicorn commutesure.app:app --app-dir ../../services/api --host 127.0.0.1 --port 8000', url: 'http://127.0.0.1:8000/health', reuseExistingServer: true, timeout: 120_000 },
    { command: 'npm run build && npm run preview', url: 'http://127.0.0.1:4173', reuseExistingServer: true, timeout: 120_000 },
  ],
})
