/**
 * tenants.ts のユニットテスト
 *
 * テスト対象:
 * - POST /: テナント作成（認証、バリデーション、レート制限）
 * - GET /mine: 自分のテナント一覧
 * - GET /reserved: 予約済みID一覧
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// vi.hoisted でモック関数をホイスト前に定義
const {
  mockVerifyIdToken,
  mockFirestoreGet,
  mockFirestoreSet,
  mockFirestoreDoc,
  mockFirestoreCollection,
  mockRunTransaction,
  mockWhere,
  mockOrderBy,
} = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockFirestoreGet: vi.fn(),
  mockFirestoreSet: vi.fn(),
  mockFirestoreDoc: vi.fn(),
  mockFirestoreCollection: vi.fn(),
  mockRunTransaction: vi.fn(),
  mockWhere: vi.fn(),
  mockOrderBy: vi.fn(),
}));

// モック設定
vi.mock("firebase-admin/app", () => ({
  getApps: vi.fn(() => [{ name: "test" }]),
  initializeApp: vi.fn(),
  cert: vi.fn(),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => {
    const mockQuery = {
      get: mockFirestoreGet,
      orderBy: mockOrderBy,
    };

    mockOrderBy.mockReturnValue(mockQuery);
    mockWhere.mockReturnValue({
      where: mockWhere,
      orderBy: mockOrderBy,
      get: mockFirestoreGet,
    });

    return {
      collection: mockFirestoreCollection.mockReturnValue({
        doc: mockFirestoreDoc.mockReturnValue({
          get: mockFirestoreGet,
          set: mockFirestoreSet,
          collection: mockFirestoreCollection,
        }),
        where: mockWhere,
      }),
      runTransaction: mockRunTransaction,
    };
  }),
}));

// テスト用アプリ作成ヘルパー
async function createTestApp() {
  const { tenantsRouter } = await import("./tenants.js");

  const app = express();
  app.use(express.json());
  app.use("/", tenantsRouter);
  return app;
}

describe("tenants router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /reserved", () => {
    it("予約済みテナントID一覧を返す", async () => {
      const app = await createTestApp();

      const res = await request(app).get("/reserved");

      expect(res.status).toBe(200);
      expect(res.body.reserved).toContain("demo");
      expect(res.body.reserved).toContain("admin");
      expect(res.body.reserved).toContain("api");
    });
  });

  describe("POST /", () => {
    it("認証ヘッダーがない場合は401を返す", async () => {
      const app = await createTestApp();

      const res = await request(app).post("/").send({ name: "Test Org" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("unauthorized");
    });

    it("Bearerトークンでない場合は401を返す", async () => {
      const app = await createTestApp();

      const res = await request(app)
        .post("/")
        .set("Authorization", "Basic token")
        .send({ name: "Test Org" });

      expect(res.status).toBe(401);
    });

    it("トークン検証失敗は401を返す", async () => {
      const app = await createTestApp();
      mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

      const res = await request(app)
        .post("/")
        .set("Authorization", "Bearer invalid-token")
        .send({ name: "Test Org" });

      expect(res.status).toBe(401);
    });

    it("メールアドレスがない場合は400を返す", async () => {
      const app = await createTestApp();
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-123",
        email: null, // メールなし
      });

      const res = await request(app)
        .post("/")
        .set("Authorization", "Bearer valid-token")
        .send({ name: "Test Org" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("email_required");
    });

    it("組織名が空の場合は400を返す", async () => {
      const app = await createTestApp();
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-123",
        email: "user@example.com",
      });

      const res = await request(app)
        .post("/")
        .set("Authorization", "Bearer valid-token")
        .send({ name: "" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_name");
    });

    it("組織名が100文字を超える場合は400を返す", async () => {
      const app = await createTestApp();
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-123",
        email: "user@example.com",
      });

      const res = await request(app)
        .post("/")
        .set("Authorization", "Bearer valid-token")
        .send({ name: "a".repeat(101) });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_name");
    });

    it("正常にテナントを作成できる", async () => {
      const app = await createTestApp();
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-123",
        email: "user@example.com",
        name: "Test User",
      });

      // テナントIDの衝突チェック（存在しない）
      mockFirestoreGet.mockResolvedValue({ exists: false });

      // トランザクション成功
      mockRunTransaction.mockImplementation(async (callback: (tx: { set: ReturnType<typeof vi.fn> }) => Promise<void>) => {
        const mockTransaction = {
          set: vi.fn(),
        };
        await callback(mockTransaction);
      });

      const res = await request(app)
        .post("/")
        .set("Authorization", "Bearer valid-token")
        .send({ name: "My Organization" });

      expect(res.status).toBe(201);
      expect(res.body.tenant).toBeDefined();
      expect(res.body.tenant.name).toBe("My Organization");
      expect(res.body.tenant.ownerEmail).toBe("user@example.com");
      expect(res.body.adminUrl).toContain("/admin");
      expect(res.body.studentUrl).toContain("/student");
    });

    it("トランザクション失敗は500を返す", async () => {
      const app = await createTestApp();
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-123",
        email: "user@example.com",
      });

      mockFirestoreGet.mockResolvedValue({ exists: false });
      mockRunTransaction.mockRejectedValue(new Error("Transaction failed"));

      const res = await request(app)
        .post("/")
        .set("Authorization", "Bearer valid-token")
        .send({ name: "My Organization" });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("transaction_failed");
    });
  });

  describe("GET /mine", () => {
    it("認証ヘッダーがない場合は401を返す", async () => {
      const app = await createTestApp();

      const res = await request(app).get("/mine");

      expect(res.status).toBe(401);
    });

    it("無効なstatusフィルタは400を返す", async () => {
      const app = await createTestApp();
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-123",
        email: "user@example.com",
      });

      const res = await request(app)
        .get("/mine?status=invalid")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_status");
    });

    it("自分のテナント一覧を取得できる", async () => {
      const app = await createTestApp();
      mockVerifyIdToken.mockResolvedValue({
        uid: "user-123",
        email: "user@example.com",
      });

      mockFirestoreGet.mockResolvedValue({
        docs: [
          {
            data: () => ({
              id: "tenant-1",
              name: "My Org",
              ownerEmail: "user@example.com",
              status: "active",
              createdAt: { toDate: () => new Date("2026-01-01") },
            }),
          },
        ],
      });

      const res = await request(app)
        .get("/mine")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.tenants).toHaveLength(1);
      expect(res.body.tenants[0].name).toBe("My Org");
    });
  });
});
