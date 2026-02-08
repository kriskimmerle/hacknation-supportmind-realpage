import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: process.env.PW_BASE_URL || "http://localhost:9000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "PORT=9000 npm run dev -- --port 9000",
    url: "http://localhost:9000",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      DATASET_PATH:
        process.env.DATASET_PATH ||
        "/Users/yashwanthreddy.paakaala/Downloads/SupportMind__Final_Data.xlsx",
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
