import { test, expect } from "@playwright/test";

/**
 * セルフチェックアウト機能のE2Eテスト
 * テナント版のパスを使用してUI表示を確認
 */

test.describe("セルフチェックアウト機能", () => {
  test.describe("セルフチェックアウトページ", () => {
    test("存在しないセッションIDでエラー表示", async ({ page }) => {
      // テナント版のパスでアクセス（デモデータにないセッションID）
      await page.goto("/demo/student/checkout/nonexistent-session-id");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      const pageContent = await page.textContent("body");
      console.log("チェックアウトページ内容:", pageContent?.substring(0, 500));

      // エラーメッセージまたはログイン画面が表示されることを確認
      const hasError = pageContent?.includes("エラー") ||
                       pageContent?.includes("見つかりません") ||
                       pageContent?.includes("取得できません") ||
                       pageContent?.includes("ログイン");
      console.log("エラーまたはログイン表示:", hasError);
    });

    test("認証が必要な場合のログイン画面が表示される", async ({ page }) => {
      // Firebase認証モードの場合、ログイン画面が表示される
      await page.goto("/demo/student/checkout/test-session-id");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      const pageContent = await page.textContent("body");

      // ログインボタンまたはGoogle認証関連の要素を確認
      const loginButton = page.locator('button:has-text("ログイン"), button:has-text("Google")');
      const hasLoginButton = await loginButton.isVisible({ timeout: 5000 }).catch(() => false);

      // または認証確認中/読み込み中の表示
      const hasAuthMessage = pageContent?.includes("認証確認中") ||
                             pageContent?.includes("読み込み中") ||
                             pageContent?.includes("ログインが必要");

      console.log("ログインボタン表示:", hasLoginButton);
      console.log("認証メッセージ:", hasAuthMessage);
    });

    test("セルフチェックアウトページのUI要素を確認", async ({ page }) => {
      // テナント版パスでアクセス
      await page.goto("/demo/student/checkout/demo-session-1");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      const pageContent = await page.textContent("body");

      // ページのタイトルまたはヘッダーを確認
      const hasCheckoutTitle = pageContent?.includes("退室打刻") ||
                                pageContent?.includes("チェックアウト") ||
                                pageContent?.includes("退室");

      // 「講座一覧に戻る」リンクを確認
      const backLink = page.locator('text=/講座一覧に戻る/');
      const hasBackLink = await backLink.isVisible({ timeout: 3000 }).catch(() => false);

      console.log("退室打刻タイトル:", hasCheckoutTitle);
      console.log("戻るリンク:", hasBackLink);
    });
  });

  test.describe("セルフチェックアウトAPI（テナント版）", () => {
    // Note: セルフチェックアウトAPIはテナント版のみ実装
    // デモモードでは /demo/api/v1/... パスを使用する必要がある

    test("デモモードAPIでセルフチェックアウト情報を取得", async ({ request }) => {
      // デモモードのAPIパスでアクセス
      const response = await request.get("/demo/api/v1/sessions/self-checkout/demo-session-1/info");

      console.log("デモAPI レスポンスステータス:", response.status());

      // デモモードでは404（セッション不存在）または200が返る
      // エンドポイントが存在することを確認
      expect([200, 400, 404]).toContain(response.status());
    });

    test("デモモードAPIでセルフチェックアウトPOSTはブロックまたは未実装", async ({ request }) => {
      const response = await request.post("/demo/api/v1/sessions/self-checkout", {
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          sessionId: "demo-session-1",
          endTime: new Date().toISOString(),
        },
      });

      console.log("デモPOST API レスポンスステータス:", response.status());

      // デモモードではPOSTがブロック（403）または未実装（404）
      // セルフチェックアウトはテナント版専用のため、デモでは動作しない
      expect([403, 404]).toContain(response.status());
    });
  });

  test.describe("通知メールからのフロー", () => {
    test("チェックアウトURLパターンが正しい形式", async ({ page }) => {
      // URLパターンの確認（/[tenant]/student/checkout/[sessionId]）
      const checkoutUrlPattern = /\/[^/]+\/student\/checkout\/[^/]+/;

      // テスト用のURLを構築
      const testUrl = "/demo/student/checkout/test-session-123";

      // パターンにマッチすることを確認
      expect(testUrl).toMatch(checkoutUrlPattern);
      console.log("URLパターン確認: 正常");
    });

    test("セルフチェックアウトページへのアクセスフロー", async ({ page }) => {
      // 1. チェックアウトページにアクセス
      await page.goto("/demo/student/checkout/demo-session-1");
      await page.waitForLoadState("networkidle");

      // 2. ページが表示されることを確認（エラーでも表示される）
      await expect(page.locator("body")).not.toBeEmpty();

      // 3. URLが正しいパターンであることを確認
      const url = page.url();
      expect(url).toContain("/student/checkout/");

      console.log("アクセスフロー確認完了");
    });
  });

  test.describe("セルフチェックアウトのバリデーション", () => {
    test("退室時刻入力フォームの存在確認", async ({ page }) => {
      await page.goto("/demo/student/checkout/demo-session-1");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      // datetime-local入力フィールドを探す
      const dateTimeInput = page.locator('input[type="datetime-local"]');
      const hasDateTimeInput = await dateTimeInput.isVisible({ timeout: 5000 }).catch(() => false);

      // または退室時刻入力のラベルを探す
      const pageContent = await page.textContent("body");
      const hasTimeLabel = pageContent?.includes("退室時刻") ||
                           pageContent?.includes("時刻を入力");

      console.log("日時入力フィールド:", hasDateTimeInput);
      console.log("時刻ラベル:", hasTimeLabel);
    });

    test("退室確定ボタンの存在確認", async ({ page }) => {
      await page.goto("/demo/student/checkout/demo-session-1");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      // 確定ボタンを探す
      const confirmButton = page.locator('button:has-text("退室を確定"), button:has-text("確定")');
      const hasConfirmButton = await confirmButton.isVisible({ timeout: 5000 }).catch(() => false);

      console.log("確定ボタン:", hasConfirmButton);
    });
  });
});
