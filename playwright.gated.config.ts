import { defineConfig, devices } from "@playwright/test";

const gatedEnv = {
  APP_MODE: "gated",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgres://ostt:ostt@127.0.0.1:54329/ostt_dev",
  AUTH_SECRET:
    process.env.AUTH_SECRET ?? "ostt-synth-auth-secret-e2e-not-production",
  AUTH_URL: "http://127.0.0.1:3000",
  AUTH_E2E_CAPTURE: "1",
};

export default defineConfig({
  testDir: "./e2e",
  testMatch: /\.gated\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      ...gatedEnv,
    },
  },
  projects: [
    {
      name: "chromium-gated",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
