import { test, expect } from "@playwright/test";

test.describe("テナント登録", () => {
  test.describe("登録ページUI", () => {
    test("登録ページにアクセスできる", async ({ page }) => {
      await page.goto("/register");
      // ページタイトルが表示される
      await expect(page.locator("text=新規登録")).toBeVisible();
    });

    test("未認証時はログインボタンが表示される", async ({ page }) => {
      await page.goto("/register");
      await page.waitForLoadState("networkidle");

      // Googleログインボタンが表示される
      const loginButton = page.locator('button:has-text("Googleでログイン")');
      await expect(loginButton).toBeVisible();
    });

    test("ホームへ戻るリンクが機能する", async ({ page }) => {
      await page.goto("/register");
      await page.waitForLoadState("networkidle");

      // ホームに戻るリンクをクリック
      const homeLink = page.locator('a:has-text("ホームに戻る")');
      await expect(homeLink).toBeVisible();
      await homeLink.click();

      // ホームページに遷移する
      await expect(page).toHaveURL("/");
    });
  });

  test.describe("ホームページからのリンク", () => {
    test("ホームに登録リンクが表示される", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // 登録リンクが表示される
      const registerLink = page.locator('a[href="/register"]');
      await expect(registerLink).toBeVisible();
    });

    test("登録リンクから登録ページに遷移できる", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // 登録リンクをクリック
      const registerLink = page.locator('a[href="/register"]');
      await registerLink.click();

      // 登録ページに遷移する
      await expect(page).toHaveURL("/register");
    });
  });

  test.describe("テナントルート（[tenant]）", () => {
    test("デモテナントの管理画面にアクセスできる", async ({ page }) => {
      await page.goto("/demo/admin");
      await expect(page.locator("h1")).toContainText("管理画面");
    });

    test("新しい[tenant]ルートが機能する", async ({ page }) => {
      // [tenant]ルートでデモにアクセス
      // 注: "demo"は予約済みだが、既存の/demo/*ルートとして動作
      await page.goto("/demo");
      await page.waitForLoadState("networkidle");

      // ナビゲーションリンクが表示される
      await expect(page.locator('a:has-text("管理者向け")')).toBeVisible();
      await expect(page.locator('a:has-text("受講者向け")')).toBeVisible();
    });

    test("[tenant]/admin/coursesにアクセスできる", async ({ page }) => {
      await page.goto("/demo/admin/courses");
      await expect(page.locator("h1")).toContainText("講座管理");
      await page.waitForLoadState("networkidle");
    });

    test("[tenant]/student/coursesにアクセスできる", async ({ page }) => {
      await page.goto("/demo/student/courses");
      await expect(page.locator("h1")).toContainText("講座");
      await page.waitForLoadState("networkidle");
    });
  });

  test.describe("予約済みテナントID API", () => {
    test("予約済みID一覧を取得できる", async ({ request }) => {
      const response = await request.get("/api/v2/tenants/reserved");
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.reserved).toContain("demo");
      expect(data.reserved).toContain("admin");
      expect(data.reserved).toContain("tenants");
    });
  });

  test.describe("テナント作成API（認証なし）", () => {
    test("認証なしでテナント作成するとエラーになる", async ({ request }) => {
      const response = await request.post("/api/v2/tenants", {
        data: { name: "テスト組織" },
      });

      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("unauthorized");
    });
  });
});
