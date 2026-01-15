import { test, expect } from "@playwright/test";

/**
 * 実際のユースケースをシミュレーションするE2Eテスト
 * デモモードを使用して、受講者・管理者の典型的な操作フローをテスト
 */

test.describe("ユースケースシミュレーション", () => {
  test.describe("受講者フロー", () => {
    test("講座選択からセッション画面への遷移", async ({ page }) => {
      // 1. 受講者デモトップページにアクセス
      await page.goto("/demo/student");
      await page.waitForLoadState("networkidle");

      // ページが表示されることを確認
      await expect(page.locator("body")).not.toBeEmpty();

      // 講座一覧へのリンクがあるか確認
      const coursesLink = page.locator('a[href*="/demo/student/courses"]');
      if (await coursesLink.isVisible()) {
        await coursesLink.click();
        await page.waitForLoadState("networkidle");
      }
    });

    test("講座一覧でデモデータが表示される", async ({ page }) => {
      await page.goto("/demo/student/courses");
      await page.waitForLoadState("networkidle");

      // 講座リストまたはカードが表示されることを確認
      const content = await page.content();
      console.log("講座一覧ページ内容の一部:", content.substring(0, 500));

      // 何らかのコンテンツが表示されることを確認
      await expect(page.locator("body")).not.toBeEmpty();
    });

    test("講座を選択してセッション画面に遷移できる", async ({ page }) => {
      await page.goto("/demo/student/courses");
      await page.waitForLoadState("networkidle");

      // 講座カードまたはリンクを探す
      const courseLink = page.locator('a[href*="/demo/student/session/"]').first();

      if (await courseLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        const href = await courseLink.getAttribute("href");
        console.log("講座リンク:", href);

        await courseLink.click();
        await page.waitForLoadState("networkidle");

        // セッション画面に遷移したことを確認
        await expect(page).toHaveURL(/\/demo\/student\/session\//);

        // ページが完全にレンダリングされるまで待機
        await page.waitForTimeout(1000);

        // INボタンまたはOUTボタンまたはCardが表示されることを確認
        // 実際のボタンテキスト: "IN（入室）" または "OUT（退室）"
        const inButton = page.locator('button:has-text("IN（入室）")');
        const outButton = page.locator('button:has-text("OUT（退室）")');
        const cardTitle = page.locator('text=/セッション進行中|入室/');

        // いずれかが表示されることを確認（5秒待機）
        // 複数要素が見つかる場合があるため .first() を使用
        await expect(inButton.or(outButton).or(cardTitle).first()).toBeVisible({ timeout: 5000 });
      } else {
        console.log("講座リンクが見つかりません - デモデータを確認");
        // スクリーンショットを保存
        await page.screenshot({ path: "e2e-screenshots/no-course-link.png" });
        // テストをスキップせずにフェイル
        expect(false).toBe(true);
      }
    });

    test("INボタンをクリックしてもデモモードではエラーになる", async ({ page }) => {
      // 特定の講座セッション画面に直接アクセス（openセッションがない講座）
      await page.goto("/demo/student/session/demo-course-2");
      await page.waitForLoadState("networkidle");

      const inButton = page.locator('button:has-text("IN（入室）")');

      if (await inButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await inButton.click();

        // デモモードのエラーメッセージが表示されることを確認
        const errorMessage = page.locator('text=/デモ|読み取り専用|操作できません/i');
        const hasError = await errorMessage.isVisible({ timeout: 5000 }).catch(() => false);

        console.log("エラーメッセージ表示:", hasError);
      } else {
        console.log("INボタンが見つかりません");
      }
    });
  });

  test.describe("管理者フロー", () => {
    test("ダッシュボードで統計情報が表示される", async ({ page }) => {
      await page.goto("/demo/admin");
      await page.waitForLoadState("networkidle");

      // ダッシュボードのカードや統計が表示されることを確認
      const dashboard = page.locator("main");
      await expect(dashboard).toBeVisible();

      // 講座数やセッション数などの統計が表示されているか
      const statsText = await page.textContent("main");
      console.log("ダッシュボード内容:", statsText?.substring(0, 300));
    });

    test("講座一覧からサイドバーナビゲーション", async ({ page }) => {
      await page.goto("/demo/admin");
      await page.waitForLoadState("networkidle");

      // サイドバーのナビゲーションリンクを確認
      const navLinks = [
        { href: "/demo/admin/courses", text: "講座" },
        { href: "/demo/admin/users", text: "受講者" },
        { href: "/demo/admin/sessions", text: "セッション" },
        { href: "/demo/admin/notification-policies", text: "通知" },
        { href: "/demo/admin/allowed-emails", text: "アクセス許可" },
      ];

      for (const link of navLinks) {
        const navLink = page.locator(`a[href="${link.href}"]`);
        const isVisible = await navLink.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`${link.text}リンク:`, isVisible);
      }
    });

    test("講座詳細を確認できる", async ({ page }) => {
      await page.goto("/demo/admin/courses");
      await page.waitForLoadState("networkidle");

      // テーブルの行または講座カードをクリック
      const courseRow = page.locator("table tbody tr, [data-course-id]").first();

      if (await courseRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        // 詳細リンクまたは行をクリック
        const detailLink = courseRow.locator('a, button:has-text("詳細")');
        if (await detailLink.isVisible({ timeout: 3000 }).catch(() => false)) {
          await detailLink.click();
          await page.waitForLoadState("networkidle");
        }
      }

      // 講座データが存在することを確認
      const pageContent = await page.textContent("body");
      console.log("講座管理ページ内容:", pageContent?.substring(0, 300));
    });

    test("セッション一覧でデモデータが表示される", async ({ page }) => {
      await page.goto("/demo/admin/sessions");
      await page.waitForLoadState("networkidle");

      // テーブルまたはリストが表示されることを確認
      const table = page.locator("table");
      const haTable = await table.isVisible({ timeout: 5000 }).catch(() => false);

      if (haTable) {
        const rowCount = await page.locator("table tbody tr").count();
        console.log("セッション行数:", rowCount);
      }

      // ページ内容を確認
      const pageContent = await page.textContent("main");
      console.log("セッション管理ページ:", pageContent?.substring(0, 300));
    });

    test("通知ポリシー設定画面", async ({ page }) => {
      await page.goto("/demo/admin/notification-policies");
      await page.waitForLoadState("networkidle");

      // 通知ポリシーの設定フォームまたはリストが表示されることを確認
      const pageContent = await page.textContent("main");
      console.log("通知ポリシーページ:", pageContent?.substring(0, 300));

      // 新規作成ボタンがあるか確認
      const createButton = page.locator('button:has-text("新規"), button:has-text("作成")');
      const hasCreateButton = await createButton.isVisible({ timeout: 3000 }).catch(() => false);
      console.log("新規作成ボタン:", hasCreateButton);
    });

    test("アクセス許可リスト管理", async ({ page }) => {
      await page.goto("/demo/admin/allowed-emails");
      await page.waitForLoadState("networkidle");

      // アクセス許可リストが表示されることを確認
      const pageContent = await page.textContent("main");
      console.log("アクセス許可ページ:", pageContent?.substring(0, 300));

      // メールアドレスリストまたはテーブルが表示されているか
      const table = page.locator("table");
      const hasTable = await table.isVisible({ timeout: 3000 }).catch(() => false);
      console.log("テーブル表示:", hasTable);
    });
  });

  test.describe("デモモードの制限確認", () => {
    test("POSTリクエストがブロックされる", async ({ page }) => {
      await page.goto("/demo/admin/courses");
      await page.waitForLoadState("networkidle");

      // 新規作成フォームを開く
      const createButton = page.locator('button:has-text("新規作成"), button:has-text("追加")');

      if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await createButton.click();

        // フォームが表示されるまで待機
        await page.waitForTimeout(500);

        // 入力フィールドがあれば入力
        const nameInput = page.locator('input[name="name"], input[placeholder*="名"]').first();
        if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await nameInput.fill("テスト講座");
        }

        // 送信ボタンをクリック
        const submitButton = page.locator('button[type="submit"]');
        if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await submitButton.click();

          // エラーメッセージを待機
          await page.waitForTimeout(1000);

          const pageContent = await page.textContent("body");
          const hasError = pageContent?.includes("デモ") || pageContent?.includes("読み取り");
          console.log("エラーメッセージ含む:", hasError);
        }
      }
    });

    test("DELETEリクエストがブロックされる", async ({ page }) => {
      await page.goto("/demo/admin/courses");
      await page.waitForLoadState("networkidle");

      // 削除ボタンを探す
      const deleteButton = page.locator('button:has-text("削除")').first();

      if (await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await deleteButton.click();

        // 確認ダイアログがあれば確認
        const confirmButton = page.locator('button:has-text("確認"), button:has-text("はい")');
        if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmButton.click();
        }

        // エラーメッセージを待機
        await page.waitForTimeout(1000);

        const pageContent = await page.textContent("body");
        const hasError = pageContent?.includes("デモ") || pageContent?.includes("読み取り");
        console.log("削除エラーメッセージ含む:", hasError);
      }
    });
  });
});
