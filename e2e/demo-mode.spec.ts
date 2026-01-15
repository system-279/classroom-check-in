import { test, expect } from "@playwright/test";

test.describe("デモモード", () => {
  test.describe("トップページ", () => {
    test("デモリンクが表示される", async ({ page }) => {
      await page.goto("/");
      // ログインページまたはホームページにデモリンクがあること
      const demoLink = page.locator('a[href="/demo/admin"]');
      await expect(demoLink).toBeVisible();
    });
  });

  test.describe("管理画面デモ", () => {
    test("管理画面トップにアクセスできる", async ({ page }) => {
      await page.goto("/demo/admin");
      await expect(page.locator("h1")).toContainText("管理画面");
    });

    test("講座一覧が表示される", async ({ page }) => {
      await page.goto("/demo/admin/courses");
      await expect(page.locator("h1")).toContainText("講座管理");
      // テーブルまたはデータが表示されるまで待機
      await page.waitForLoadState("networkidle");
    });

    test("ユーザー一覧が表示される", async ({ page }) => {
      await page.goto("/demo/admin/users");
      await expect(page.locator("h1")).toContainText("受講者管理");
      await page.waitForLoadState("networkidle");
    });

    test("セッション一覧が表示される", async ({ page }) => {
      await page.goto("/demo/admin/sessions");
      await expect(page.locator("h1")).toContainText("セッション管理");
      await page.waitForLoadState("networkidle");
    });

    test("通知ポリシー一覧が表示される", async ({ page }) => {
      await page.goto("/demo/admin/notification-policies");
      await expect(page.locator("h1")).toContainText("通知ポリシー");
      await page.waitForLoadState("networkidle");
    });

    test("アクセス許可一覧が表示される", async ({ page }) => {
      await page.goto("/demo/admin/allowed-emails");
      await expect(page.locator("h1")).toContainText("アクセス許可");
      await page.waitForLoadState("networkidle");
    });
  });

  test.describe("受講者画面デモ", () => {
    test("講座一覧が表示される", async ({ page }) => {
      await page.goto("/demo/student/courses");
      await expect(page.locator("h1")).toContainText("講座");
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
