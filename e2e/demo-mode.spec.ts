import { test, expect } from "@playwright/test";

test.describe("デモモード", () => {
  // Cloud Runコールドスタート対応: API呼び出しを伴うテストのタイムアウトを延長
  test.setTimeout(30_000);

  test.describe("デモトップページ", () => {
    test("デモリンクが表示される", async ({ page }) => {
      await page.goto("/demo");
      await expect(page.getByRole("link", { name: "管理画面を見る" })).toBeVisible();
      await expect(page.getByRole("link", { name: "受講者画面を見る" })).toBeVisible();
    });
  });

  test.describe("管理画面デモ", () => {
    test("管理画面トップにアクセスできる", async ({ page }) => {
      await page.goto("/demo/admin");
      await expect(page.locator("h1")).toContainText("管理画面");
    });

    test("講座一覧が表示される", async ({ page }) => {
      await page.goto("/demo/admin/courses");
      await expect(page.locator("h1")).toContainText("講座管理", { timeout: 15_000 });
      await page.waitForLoadState("networkidle");
    });

    test("ユーザー一覧が表示される", async ({ page }) => {
      await page.goto("/demo/admin/users");
      await expect(page.locator("h1")).toContainText("受講者管理", { timeout: 15_000 });
      await page.waitForLoadState("networkidle");
    });

    test("セッション一覧が表示される", async ({ page }) => {
      await page.goto("/demo/admin/sessions");
      await expect(page.locator("h1")).toContainText("セッション管理", { timeout: 15_000 });
      await page.waitForLoadState("networkidle");
    });

    test("通知ポリシー一覧が表示される", async ({ page }) => {
      await page.goto("/demo/admin/notification-policies");
      await expect(page.locator("h1")).toContainText("通知ポリシー", { timeout: 15_000 });
      await page.waitForLoadState("networkidle");
    });

    test("アクセス許可一覧が表示される", async ({ page }) => {
      await page.goto("/demo/admin/allowed-emails");
      await expect(page.locator("h1")).toContainText("アクセス許可", { timeout: 15_000 });
      await page.waitForLoadState("networkidle");
    });
  });

  test.describe("受講者画面デモ", () => {
    test("講座一覧が表示される", async ({ page }) => {
      await page.goto("/demo/student/courses");
      await expect(page.locator("h1")).toContainText("講座", { timeout: 15_000 });
      await page.waitForLoadState("networkidle");
    });
  });

  test.describe("読み取り専用制限", () => {
    test("講座作成がブロックされる（APIエラー）", async ({ page }) => {
      await page.goto("/demo/admin/courses");
      await page.waitForLoadState("networkidle");

      // 新規作成ボタンをクリック
      const createButton = page.locator('button:has-text("新規作成"), a:has-text("新規作成")');
      if (await createButton.isVisible()) {
        await createButton.click();

        // フォームに入力
        const nameInput = page.locator('input[name="name"], input[placeholder*="講座名"]');
        if (await nameInput.isVisible()) {
          await nameInput.fill("テスト講座");

          // 送信ボタンをクリック
          const submitButton = page.locator('button[type="submit"], button:has-text("作成")');
          await submitButton.click();

          // エラーメッセージが表示されることを確認
          await expect(page.locator("text=デモモード")).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });
});
