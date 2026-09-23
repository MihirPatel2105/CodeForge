import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel: "chrome",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
