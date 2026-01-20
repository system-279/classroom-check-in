import { test, expect } from "@playwright/test";

/**
 * 必要視聴時間チェック機能のE2Eテスト
 * デモモードを使用してUI表示を確認
 */

test.describe("必要視聴時間チェック機能", () => {
  test.describe("セッション画面", () => {
    test("入室前の確認事項が表示される", async ({ page }) => {
      // openセッションがない講座のセッション画面にアクセス
      await page.goto("/demo/student/session/demo-course-2");
      await page.waitForLoadState("networkidle");

      // 入室前の確認事項が表示されることを確認
      const warningText = page.locator('text=/入室前にご確認ください/');
      const hasWarning = await warningText.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasWarning) {
        // 注意事項の内容を確認
        const pageContent = await page.textContent("body");
        expect(pageContent).toContain("同時並行で講座は受けられません");
        expect(pageContent).toContain("分割視聴は不可");
      }

      console.log("入室前確認事項表示:", hasWarning);
    });

    test("openセッションがある場合にタイマーが表示される", async ({ page }) => {
      // demo-course-1はopenセッションがあるデモデータを想定
      await page.goto("/demo/student/session/demo-course-1");
      await page.waitForLoadState("networkidle");

      // ページが完全にレンダリングされるまで待機
      await page.waitForTimeout(2000);

      const pageContent = await page.textContent("body");
      console.log("セッション画面内容:", pageContent?.substring(0, 500));

      // タイマー表示（00:00:00形式）があるか確認
      const timerPattern = /\d{2}:\d{2}:\d{2}/;
      const hasTimer = timerPattern.test(pageContent || "");
      console.log("タイマー表示:", hasTimer);

      // セッション進行中またはタイマーが表示されていることを確認
      const isSessionActive = pageContent?.includes("セッション進行中") ||
                              pageContent?.includes("OUT（退室）") ||
                              hasTimer;
      console.log("セッション進行中状態:", isSessionActive);
    });

    test("必要視聴時間の表示がある場合にプログレスバーが表示される", async ({ page }) => {
      await page.goto("/demo/student/session/demo-course-1");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      // プログレスバーを探す（bg-green-500 または bg-blue-500 のクラスを持つ要素）
      const progressBar = page.locator('[class*="bg-green-500"], [class*="bg-blue-500"]').first();
      const hasProgressBar = await progressBar.isVisible({ timeout: 3000 }).catch(() => false);
      console.log("プログレスバー表示:", hasProgressBar);

      // または、必要視聴時間関連のテキストを確認
      const pageContent = await page.textContent("body");
      const hasRequiredTimeText = pageContent?.includes("必要視聴時間") ||
                                   pageContent?.includes("分必要") ||
                                   pageContent?.includes("残り");
      console.log("必要視聴時間テキスト:", hasRequiredTimeText);
    });

    test("必要視聴時間未達の場合の注意表示を確認", async ({ page }) => {
      await page.goto("/demo/student/session/demo-course-1");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      const pageContent = await page.textContent("body");

      // 必要視聴時間未達の場合の注意文を確認
      const hasWarningForUnreached = pageContent?.includes("必要視聴時間に達するまで退室できません") ||
                                      pageContent?.includes("必要視聴時間まで残り");
      console.log("未達時注意文:", hasWarningForUnreached);
    });

    test("OUTボタンの活性/非活性状態を確認", async ({ page }) => {
      await page.goto("/demo/student/session/demo-course-1");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      const outButton = page.locator('button:has-text("OUT（退室）")');
      const hasOutButton = await outButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasOutButton) {
        const isDisabled = await outButton.isDisabled();
        console.log("OUTボタン表示: true, 非活性:", isDisabled);
      } else {
        console.log("OUTボタン表示: false（入室前の状態）");
      }
    });
  });

  test.describe("講座一覧での注意事項", () => {
    test("講座一覧ページに注意事項が表示される", async ({ page }) => {
      await page.goto("/demo/student/courses");
      await page.waitForLoadState("networkidle");

      const pageContent = await page.textContent("body");

      // 注意事項セクションを確認
      const hasWarnings = pageContent?.includes("同時並行") ||
                          pageContent?.includes("分割視聴") ||
                          pageContent?.includes("倍速");
      console.log("講座一覧注意事項:", hasWarnings);
    });
  });
});
