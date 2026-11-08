import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev:e2e",
    url: "http://127.0.0.1:4173/e2e/harness.html",
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
