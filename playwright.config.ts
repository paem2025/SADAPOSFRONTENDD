import { defineConfig, devices } from "@playwright/test"

const PORT = 3000

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "powershell -NoProfile -Command \"$ErrorActionPreference='Stop'; New-Item -ItemType Directory -Path '.next/standalone/.next' -Force | Out-Null; Copy-Item -Path '.next/static' -Destination '.next/standalone/.next/static' -Recurse -Force; if (Test-Path 'public') { Copy-Item -Path 'public' -Destination '.next/standalone/public' -Recurse -Force }; node .next/standalone/server.js\"",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
