import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Webサーバー設定
  // CI環境: webServerを設定しない（CI側で起動）
  // ローカル: 既存サーバーがあればそれを使用、なければ起動
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev -w @classroom-check-in/web",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120000,
      },
});
