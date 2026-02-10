import { test, expect, type APIRequestContext } from "@playwright/test";
import { initializeApp, cert, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * 入退室フルフローE2Eテスト（Firestoreエミュレータ使用）
 *
 * テナントAPI経路で、受講者のIN→heartbeat→OUT→管理画面表示を検証する。
 * テスト用データ（講座・ユーザー・enrollment）はbeforeAllでAPI経由で作成する。
 *
 * 前提条件:
 *   - FIRESTORE_EMULATOR_HOST が設定されていること（例: localhost:8081）
 *   - API: http://localhost:8080 (AUTH_MODE=dev)
 *   - Web: http://localhost:3000 (NEXT_PUBLIC_AUTH_MODE=dev)
 *
 * 注意:
 *   - テナントIDは動的生成（test-e2e-${timestamp}）
 *   - テストデータは完全クリーンアップ（講座・ユーザー・enrollment・セッション）
 *   - テスト順序依存のため serial 実行
 */

const API_BASE = process.env.API_BASE_URL || "http://localhost:8080";

// 既存のテスト用テナントを使用（テナント作成APIは認証が必要なため）
const TENANT_ID = process.env.TEST_TENANT_ID || "6shh0riw";
const TEST_COURSE_NAME = `E2Eテスト講座-${Date.now()}`;
const TEST_USER_EMAIL = `e2e-student-${Date.now()}@example.com`;
const TEST_USER_NAME = `E2Eテスト受講者`;

// 管理者用ヘッダー（テナントAPI用にx-user-email追加）
const ADMIN_HEADERS = {
  "Content-Type": "application/json",
  "X-User-Id": "admin-e2e",
  "X-User-Role": "admin",
  "X-User-Email": "admin-e2e@example.com",
};

// テスト中に作成されたリソースのID
let courseId: string;
let userId: string;
let enrollmentId: string;

/**
 * API直接呼び出しヘルパー
 */
async function apiRequest(
  request: APIRequestContext,
  method: string,
  path: string,
  data?: Record<string, unknown>,
  headers?: Record<string, string>
) {
  const opts: Parameters<APIRequestContext["fetch"]>[1] = {
    method,
    headers: headers ?? ADMIN_HEADERS,
  };
  if (data) opts.data = data;
  return request.fetch(`${API_BASE}${path}`, opts);
}

/**
 * page.route() で API リクエストのヘッダーを受講者用に差し替える
 */
async function setupStudentHeaders(page: import("@playwright/test").Page) {
  await page.route(`**/api/v2/${TENANT_ID}/**`, async (route) => {
    const headers = {
      ...route.request().headers(),
      "x-user-id": userId,
      "x-user-role": "student",
      "x-user-email": TEST_USER_EMAIL,
    };
    await route.continue({ headers });
  });
}

test.describe("入退室フルフロー", () => {
  // serial実行（テスト順序依存）
  test.describe.configure({ mode: "serial", timeout: 180000 });

  // ---------- エミュレータ必須チェック ----------
  test.beforeAll(async ({ request }) => {
    // Firestoreエミュレータが設定されていない場合はテストをスキップ
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      throw new Error(
        "FIRESTORE_EMULATOR_HOST must be set. " +
        "Example: export FIRESTORE_EMULATOR_HOST=localhost:8081"
      );
    }

    // 0. Firestoreエミュレータにテナントとallowed_emailsを作成
    console.log(`エミュレータにテナント ${TENANT_ID} を作成中...`);

    // Firebase Admin初期化（エミュレータ用、APIサーバーと同じプロジェクトIDを使用）
    const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || "classroom-checkin-279";
    if (getApps().length === 0) {
      initializeApp({
        projectId,
      });
    }
    const db = getFirestore();

    // テナントドキュメント作成
    await db.collection("tenants").doc(TENANT_ID).set({
      organizationName: "E2Eテスト組織",
      ownerEmail: "admin-e2e@example.com",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // allowed_emailsに管理者とテスト受講者を追加
    await db.collection("tenants").doc(TENANT_ID).collection("allowed_emails").doc("admin-e2e@example.com").set({
      email: "admin-e2e@example.com",
      addedAt: new Date(),
    });

    await db.collection("tenants").doc(TENANT_ID).collection("allowed_emails").doc(TEST_USER_EMAIL).set({
      email: TEST_USER_EMAIL,
      addedAt: new Date(),
    });

    console.log(`テナント ${TENANT_ID} とallowed_emailsを作成しました`);

    // 1. テスト用講座を作成（requiredWatchMin=1 → 1分で退室可能）
    const courseRes = await apiRequest(
      request,
      "POST",
      `/api/v2/${TENANT_ID}/admin/courses`,
      {
        name: TEST_COURSE_NAME,
        description: "E2Eテスト用の講座",
        requiredWatchMin: 1,
        enabled: true,
        visible: true,
      }
    );
    if (!courseRes.ok()) {
      const errorBody = await courseRes.text();
      console.error(`講座作成失敗: ${courseRes.status()} ${courseRes.statusText()}`);
      console.error(`レスポンス: ${errorBody}`);
      console.error(`リクエストURL: ${API_BASE}/api/v2/${TENANT_ID}/admin/courses`);
      console.error(`ヘッダー:`, ADMIN_HEADERS);
    }
    expect(courseRes.ok()).toBeTruthy();
    const courseBody = await courseRes.json();
    courseId = courseBody.course.id;

    // 2. テスト用ユーザーを作成（allowed_emailsにも自動追加される: ADR-0027）
    const userRes = await apiRequest(
      request,
      "POST",
      `/api/v2/${TENANT_ID}/admin/users`,
      {
        email: TEST_USER_EMAIL,
        name: TEST_USER_NAME,
        role: "student",
      }
    );
    if (!userRes.ok()) {
      const errorBody = await userRes.text();
      console.error(`ユーザー作成失敗: ${userRes.status()} ${userRes.statusText()}`);
      console.error(`レスポンス: ${errorBody}`);
    }
    expect(userRes.ok()).toBeTruthy();
    const userBody = await userRes.json();
    userId = userBody.user.id;

    // 3. 受講登録を作成
    const enrollRes = await apiRequest(
      request,
      "POST",
      `/api/v2/${TENANT_ID}/admin/enrollments`,
      {
        courseId,
        userId,
        role: "student",
      }
    );
    if (!enrollRes.ok()) {
      const errorBody = await enrollRes.text();
      console.error(`enrollment作成失敗: ${enrollRes.status()} ${enrollRes.statusText()}`);
      console.error(`レスポンス: ${errorBody}`);
    }
    expect(enrollRes.ok()).toBeTruthy();
    const enrollBody = await enrollRes.json();
    enrollmentId = enrollBody.enrollment.id;
  });

  // ---------- 完全クリーンアップ ----------
  test.afterAll(async ({ request }) => {
    // 依存関係を考慮した削除順序: セッション → enrollment → ユーザー → 講座 → allowed_emails

    // 1. セッションを削除（あれば）
    try {
      const sessionsRes = await apiRequest(
        request,
        "GET",
        `/api/v2/${TENANT_ID}/admin/sessions?userId=${userId}&courseId=${courseId}`
      );
      if (sessionsRes.ok()) {
        const body = await sessionsRes.json();
        for (const s of body.sessions ?? []) {
          await apiRequest(
            request,
            "DELETE",
            `/api/v2/${TENANT_ID}/admin/sessions/${s.id}`
          );
        }
      }
    } catch (e) {
      console.warn("Failed to delete sessions:", e);
    }

    // 2. enrollmentを削除
    try {
      if (enrollmentId) {
        await apiRequest(
          request,
          "DELETE",
          `/api/v2/${TENANT_ID}/admin/enrollments/${enrollmentId}`
        );
      }
    } catch (e) {
      console.warn("Failed to delete enrollment:", e);
    }

    // 3. ユーザーを削除
    try {
      if (userId) {
        await apiRequest(
          request,
          "DELETE",
          `/api/v2/${TENANT_ID}/admin/users/${userId}`
        );
      }
    } catch (e) {
      console.warn("Failed to delete user:", e);
    }

    // 4. 講座を削除
    try {
      if (courseId) {
        await apiRequest(
          request,
          "DELETE",
          `/api/v2/${TENANT_ID}/admin/courses/${courseId}`
        );
      }
    } catch (e) {
      console.warn("Failed to delete course:", e);
    }

    // 5. allowed_emailsを削除（ユーザー作成時に自動追加されたもの）
    try {
      const allowedEmailsRes = await apiRequest(
        request,
        "GET",
        `/api/v2/${TENANT_ID}/admin/allowed-emails`
      );
      if (allowedEmailsRes.ok()) {
        const body = await allowedEmailsRes.json();
        const targetEmail = body.allowedEmails?.find(
          (e: { email: string }) => e.email === TEST_USER_EMAIL
        );
        if (targetEmail) {
          await apiRequest(
            request,
            "DELETE",
            `/api/v2/${TENANT_ID}/admin/allowed-emails/${targetEmail.id}`
          );
        }
      }
    } catch (e) {
      console.warn("Failed to delete allowed_emails:", e);
    }

    // 6. Firestoreエミュレータからテナントとallowed_emailsを削除
    try {
      console.log(`エミュレータからテナント ${TENANT_ID} を削除中...`);
      const db = getFirestore();

      // allowed_emailsサブコレクションを削除
      const allowedEmailsSnapshot = await db
        .collection("tenants")
        .doc(TENANT_ID)
        .collection("allowed_emails")
        .get();

      for (const doc of allowedEmailsSnapshot.docs) {
        await doc.ref.delete();
      }

      // テナントドキュメントを削除
      await db.collection("tenants").doc(TENANT_ID).delete();

      console.log(`テナント ${TENANT_ID} を削除しました`);
    } catch (e) {
      console.warn("Failed to delete tenant from Firestore:", e);
    }
  });

  // ---------- テストケース ----------

  test("1. 受講者が講座一覧を表示できる", async ({ page }) => {
    await setupStudentHeaders(page);

    await page.goto(`/${TENANT_ID}/student/courses`);
    await page.waitForLoadState("networkidle");

    // 講座一覧タイトルが表示される
    await expect(page.locator("h1")).toContainText("講座一覧");

    // テスト用講座が表示される
    await expect(page.locator(`text=${TEST_COURSE_NAME}`)).toBeVisible({
      timeout: 10000,
    });
  });

  test("2. 入室（IN）→ セッション作成", async ({ page }) => {
    await setupStudentHeaders(page);

    // セッション画面に直接遷移
    await page.goto(`/${TENANT_ID}/student/session/${courseId}`);
    await page.waitForLoadState("networkidle");

    // INボタンが表示されることを確認
    const inButton = page.locator('button:has-text("IN（入室）")');
    await expect(inButton).toBeVisible({ timeout: 10000 });

    // 「入室前にご確認ください」が表示される
    await expect(page.locator("text=入室前にご確認ください")).toBeVisible();

    // check-in APIレスポンスをインターセプト
    const checkInPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/sessions/check-in") &&
        res.request().method() === "POST"
    );

    // INボタンをクリック
    await inButton.click();

    // check-in APIのレスポンスを検証
    const checkInResponse = await checkInPromise;
    expect(checkInResponse.status()).toBe(201);

    // セッション進行中の状態になる
    await expect(page.locator("text=セッション進行中")).toBeVisible({
      timeout: 10000,
    });

    // OUTボタンが表示される（最初はdisabledの可能性あり）
    const outButton = page.locator('button:has-text("OUT（退室）")');
    await expect(outButton).toBeVisible();
  });

  test("3. heartbeat送信が確認できる", async ({ page }) => {
    await setupStudentHeaders(page);

    // heartbeat用のPromiseを先に設定（ページ遷移前）
    // useHeartbeat は即時送信するため、遷移直後にキャプチャ可能
    const heartbeatPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/sessions/heartbeat") &&
        res.request().method() === "POST",
      { timeout: 90000 }
    );

    // セッション画面に遷移（既にopenセッションがある状態）
    await page.goto(`/${TENANT_ID}/student/session/${courseId}`);
    await page.waitForLoadState("networkidle");

    // セッション進行中であることを確認
    await expect(page.locator("text=セッション進行中")).toBeVisible({
      timeout: 10000,
    });

    // heartbeatレスポンスを検証
    const heartbeatResponse = await heartbeatPromise;
    expect(heartbeatResponse.status()).toBe(200);
  });

  test("4. 退室（OUT）→ セッション終了", async ({ page }) => {
    await setupStudentHeaders(page);

    // セッション画面に遷移
    await page.goto(`/${TENANT_ID}/student/session/${courseId}`);
    await page.waitForLoadState("networkidle");

    // セッション進行中であることを確認
    await expect(page.locator("text=セッション進行中")).toBeVisible({
      timeout: 10000,
    });

    // OUTボタンが表示される
    const outButton = page.locator('button:has-text("OUT（退室）")');
    await expect(outButton).toBeVisible();

    // 必要視聴時間（1分）が経過するまで待機
    // SessionTimerのonTimeReachedがtrueになるとボタンが活性化
    await expect(outButton).toBeEnabled({ timeout: 90000 });

    // check-out APIレスポンスをインターセプト
    const checkOutPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/sessions/check-out") &&
        res.request().method() === "POST"
    );

    // OUTボタンをクリック
    await outButton.click();

    // check-out APIのレスポンスを検証
    const checkOutResponse = await checkOutPromise;
    expect(checkOutResponse.status()).toBe(200);

    // check-out後はsessionがnullにリセットされ入室画面に戻る、
    // または再取得時にisCompletedがtrueなら「受講済み」表示になる
    await expect(
      page.locator("text=受講済み").or(page.locator('button:has-text("IN（入室）")'))
    ).toBeVisible({ timeout: 10000 });
  });

  test("5. 管理画面でセッションが表示される", async ({ page }) => {
    // 管理画面はデフォルトのadmin-dev/adminヘッダーで表示
    // テナントAPIではx-user-emailも必要なので、ルーティングで追加
    await page.route(`**/api/v2/${TENANT_ID}/**`, async (route) => {
      const headers = {
        ...route.request().headers(),
        "x-user-id": "admin-e2e",
        "x-user-role": "admin",
        "x-user-email": "admin-e2e@example.com",
      };
      await route.continue({ headers });
    });

    await page.goto(`/${TENANT_ID}/admin/sessions`);
    await page.waitForLoadState("networkidle");

    // セッション管理タイトルが表示される
    await expect(page.locator("h1")).toContainText("セッション管理");

    // テーブルが表示されるまで待機
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 10000 });

    // テスト用ユーザーのセッションがテーブルに表示される
    const sessionRow = page.locator("table tbody tr", {
      hasText: TEST_USER_NAME,
    });
    await expect(sessionRow).toBeVisible({ timeout: 10000 });

    // ステータスが「終了」であることを確認
    await expect(sessionRow).toContainText("終了");
  });
});
