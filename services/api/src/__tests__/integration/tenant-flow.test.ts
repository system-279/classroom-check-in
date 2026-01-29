/**
 * テナント作成フロー統合テスト
 *
 * テスト対象:
 * - POST /api/v2/tenants - テナント作成
 * - GET /api/v2/tenants/mine - 自分のテナント一覧
 * - バリデーション、レート制限、認証
 *
 * Firebase Admin SDK をモックして実行
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import express, { Express } from "express";
import request from "supertest";

// モック関数を先に定義（hoisted）
const mockVerifyIdToken = vi.fn();
const mockRunTransaction = vi.fn();
const mockDocGet = vi.fn();
const mockDocRef = vi.fn();
const mockCollectionDoc = vi.fn();
const mockCollectionWhere = vi.fn();

// Firebase Admin SDK のモック
vi.mock("firebase-admin/firestore", () => {
  return {
    getFirestore: vi.fn(() => ({
      collection: vi.fn((name: string) => {
        if (name === "tenants") {
          return {
            doc: mockCollectionDoc,
            where: mockCollectionWhere,
          };
        }
        return {
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              doc: vi.fn(() => ({ id: "nested-doc-id" })),
            })),
          })),
        };
      }),
      runTransaction: mockRunTransaction,
    })),
  };
});

vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

// モック後にインポート
import { tenantsRouter } from "../../routes/tenants.js";

describe("テナント作成フロー統合テスト", () => {
  let app: Express;
  let testUid: string;

  // モックデータ（uidは各テストでユニークに設定）
  const createMockToken = (uid: string) => ({
    uid,
    email: "owner@example.com",
    name: "Test Owner",
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // 各テストでユニークなユーザーIDを生成（レート制限回避）
    testUid = `test-uid-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // デフォルト設定
    mockVerifyIdToken.mockResolvedValue(createMockToken(testUid));
    mockDocGet.mockResolvedValue({ exists: false });
    mockDocRef.mockReturnValue({
      id: "generated-doc-id",
      get: mockDocGet,
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({ id: "nested-doc-id" })),
      })),
    });
    mockCollectionDoc.mockImplementation(() => mockDocRef());
    mockRunTransaction.mockImplementation(async (callback: (tx: { set: Mock }) => Promise<void>) => {
      await callback({ set: vi.fn() });
    });

    // Expressアプリ作成
    app = express();
    app.use(express.json());
    app.use("/api/v2/tenants", tenantsRouter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/v2/tenants - テナント作成", () => {
    it("正常にテナントを作成できる（201）", async () => {
      const res = await request(app)
        .post("/api/v2/tenants")
        .set("Authorization", "Bearer valid-token")
        .send({ name: "テスト組織" });

      expect(res.status).toBe(201);
      expect(res.body.tenant).toBeDefined();
      expect(res.body.tenant.name).toBe("テスト組織");
      expect(res.body.tenant.ownerEmail).toBe("owner@example.com");
      expect(res.body.tenant.status).toBe("active");
      expect(res.body.adminUrl).toMatch(/^\/[a-z0-9]+\/admin$/);
      expect(res.body.studentUrl).toMatch(/^\/[a-z0-9]+\/student$/);
    });

    it("トランザクションで初期データが作成される", async () => {
      await request(app)
        .post("/api/v2/tenants")
        .set("Authorization", "Bearer valid-token")
        .send({ name: "テスト組織" });

      // runTransactionが呼ばれたことを確認
      expect(mockRunTransaction).toHaveBeenCalled();
    });

    describe("バリデーション", () => {
      it("組織名が空の場合は400エラー", async () => {
        const res = await request(app)
          .post("/api/v2/tenants")
          .set("Authorization", "Bearer valid-token")
          .send({ name: "" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("invalid_name");
      });

      it("組織名が空白のみの場合は400エラー", async () => {
        const res = await request(app)
          .post("/api/v2/tenants")
          .set("Authorization", "Bearer valid-token")
          .send({ name: "   " });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("invalid_name");
      });

      it("組織名が100文字を超える場合は400エラー", async () => {
        const longName = "あ".repeat(101);
        const res = await request(app)
          .post("/api/v2/tenants")
          .set("Authorization", "Bearer valid-token")
          .send({ name: longName });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("invalid_name");
      });

      it("組織名が100文字ちょうどの場合は成功", async () => {
        const exactName = "あ".repeat(100);
        const res = await request(app)
          .post("/api/v2/tenants")
          .set("Authorization", "Bearer valid-token")
          .send({ name: exactName });

        expect(res.status).toBe(201);
        expect(res.body.tenant.name).toBe(exactName);
      });

      it("メールアドレスがない場合は400エラー", async () => {
        mockVerifyIdToken.mockResolvedValue({
          uid: testUid,
          // email なし
        });

        const res = await request(app)
          .post("/api/v2/tenants")
          .set("Authorization", "Bearer valid-token")
          .send({ name: "テスト組織" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("email_required");
      });
    });

    describe("認証", () => {
      it("Authorizationヘッダーがない場合は401エラー", async () => {
        const res = await request(app)
          .post("/api/v2/tenants")
          .send({ name: "テスト組織" });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("unauthorized");
      });

      it("無効なトークンの場合は401エラー", async () => {
        mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

        const res = await request(app)
          .post("/api/v2/tenants")
          .set("Authorization", "Bearer invalid-token")
          .send({ name: "テスト組織" });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("unauthorized");
      });
    });

    describe("レート制限", () => {
      it("6回目の作成で429エラー", async () => {
        // 異なるユーザーIDでテスト（レート制限はユーザー単位）
        const rateLimitTestUid = `rate-limit-test-${Date.now()}`;
        mockVerifyIdToken.mockResolvedValue(createMockToken(rateLimitTestUid));

        // 5回は成功
        for (let i = 0; i < 5; i++) {
          const res = await request(app)
            .post("/api/v2/tenants")
            .set("Authorization", "Bearer valid-token")
            .send({ name: `テスト組織${i}` });
          expect(res.status).toBe(201);
        }

        // 6回目は429エラー
        const res = await request(app)
          .post("/api/v2/tenants")
          .set("Authorization", "Bearer valid-token")
          .send({ name: "テスト組織6" });

        expect(res.status).toBe(429);
        expect(res.body.error).toBe("rate_limit_exceeded");
        expect(res.body.retryAfterSec).toBeGreaterThan(0);
      });
    });

    describe("テナントID生成", () => {
      it("ID衝突時はリトライして新しいIDを生成", async () => {
        // 最初の2回は衝突、3回目で成功
        mockDocGet
          .mockResolvedValueOnce({ exists: true })
          .mockResolvedValueOnce({ exists: true })
          .mockResolvedValueOnce({ exists: false });

        const res = await request(app)
          .post("/api/v2/tenants")
          .set("Authorization", "Bearer valid-token")
          .send({ name: "テスト組織" });

        expect(res.status).toBe(201);
        expect(mockDocGet).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe("GET /api/v2/tenants/mine - 自分のテナント一覧", () => {
    it("自分のテナント一覧を取得できる", async () => {
      // モックデータ
      const mockTenants = [
        {
          id: "tenant-1",
          name: "組織1",
          ownerEmail: "owner@example.com",
          status: "active",
          createdAt: { toDate: () => new Date("2026-01-01") },
        },
        {
          id: "tenant-2",
          name: "組織2",
          ownerEmail: "owner@example.com",
          status: "active",
          createdAt: { toDate: () => new Date("2026-01-02") },
        },
      ];

      const mockSnapshot = {
        docs: mockTenants.map((t) => ({
          data: () => t,
        })),
      };

      mockCollectionWhere.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockSnapshot),
        }),
      });

      const res = await request(app)
        .get("/api/v2/tenants/mine")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.tenants).toHaveLength(2);
      expect(res.body.tenants[0].name).toBe("組織1");
    });

    it("statusフィルタを指定できる", async () => {
      const mockSnapshot = { docs: [] };
      const mockWhere = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockSnapshot),
        }),
      });
      mockCollectionWhere.mockReturnValue({
        where: mockWhere,
        orderBy: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockSnapshot),
        }),
      });

      const res = await request(app)
        .get("/api/v2/tenants/mine?status=active")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
    });

    it("無効なstatusパラメータは400エラー", async () => {
      const res = await request(app)
        .get("/api/v2/tenants/mine?status=invalid")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_status");
    });

    it("未認証の場合は401エラー", async () => {
      const res = await request(app).get("/api/v2/tenants/mine");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("unauthorized");
    });
  });

  describe("GET /api/v2/tenants/reserved - 予約済みID一覧", () => {
    it("予約済みテナントID一覧を取得できる", async () => {
      const res = await request(app).get("/api/v2/tenants/reserved");

      expect(res.status).toBe(200);
      expect(res.body.reserved).toBeInstanceOf(Array);
      expect(res.body.reserved).toContain("demo");
      expect(res.body.reserved).toContain("admin");
      expect(res.body.reserved).toContain("api");
    });
  });
});
