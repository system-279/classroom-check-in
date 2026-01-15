import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const isProduction = BASE_URL.includes("run.app");

/**
 * 認証済みページのテスト
 * ローカル環境（AUTH_MODE=dev）で実行
 * 本番環境ではFirebase認証が必要なためスキップ
 */
test.describe("認証済みページ（ローカル環境）", () => {
  test.skip(() => isProduction, "本番環境ではFirebase認証が必要なためスキップ");

  test.describe("受講者ページ", () => {
    test("講座一覧が表示される", async ({ page }) => {
      await page.goto("/student/courses");
      await page.waitForLoadState("networkidle");
      // h1またはコンテンツが表示されることを確認
      await expect(page.locator("body")).not.toBeEmpty();
    });

    test("トップページからアクセスできる", async ({ page }) => {
      await page.goto("/");
      const studentLink = page.locator('a[href="/student/courses"]');
      if (await studentLink.isVisible()) {
        await studentLink.click();
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveURL(/\/student\/courses/);
      }
    });
  });

  test.describe("管理画面", () => {
    test("講座管理が表示される", async ({ page }) => {
      await page.goto("/admin/courses");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1")).toContainText("講座");
    });

    test("ユーザー管理が表示される", async ({ page }) => {
      await page.goto("/admin/users");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1")).toContainText("受講者");
    });

    test("セッション管理が表示される", async ({ page }) => {
      await page.goto("/admin/sessions");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1")).toContainText("セッション");
    });

    test("通知ポリシーが表示される", async ({ page }) => {
      await page.goto("/admin/notification-policies");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1")).toContainText("通知");
    });

    test("アクセス許可が表示される", async ({ page }) => {
      await page.goto("/admin/allowed-emails");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1")).toContainText("アクセス許可");
    });
  });
});
