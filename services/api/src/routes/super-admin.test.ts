/**
 * super-admin.ts のユニットテスト
 *
 * テスト対象:
 * - PATCH /tenants/:id - テナント更新（name, ownerEmail, status）
 * - DELETE /tenants/:id - テナント削除（サブコレクション含む完全削除）
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// vi.hoisted でモック関数をホイスト前に定義
const {
  mockFirestoreGet,
  mockFirestoreUpdate,
  mockFirestoreDoc,
  mockFirestoreCollection,
  mockFirestoreCount,
  mockRecursiveDelete,
} = vi.hoisted(() => ({
  mockFirestoreGet: vi.fn(),
  mockFirestoreUpdate: vi.fn(),
  mockFirestoreDoc: vi.fn(),
  mockFirestoreCollection: vi.fn(),
  mockFirestoreCount: vi.fn(),
  mockRecursiveDelete: vi.fn(),
}));

// モック設定
vi.mock("firebase-admin/app", () => ({
  getApps: vi.fn(() => [{ name: "test" }]),
  initializeApp: vi.fn(),
  cert: vi.fn(),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({})),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => ({
    collection: mockFirestoreCollection.mockImplementation(() => ({
      doc: mockFirestoreDoc.mockImplementation(() => ({
        get: mockFirestoreGet,
        update: mockFirestoreUpdate,
      })),
      count: mockFirestoreCount.mockReturnValue({
        get: vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
      }),
    })),
    recursiveDelete: mockRecursiveDelete,
  })),
}));

// スーパー管理者ミドルウェアをモック
vi.mock("../middleware/super-admin.js", () => ({
  superAdminAuthMiddleware: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    // テスト用にスーパー管理者としてセット
    req.superAdmin = { email: "super@example.com" };
    next();
  },
  getAllSuperAdmins: vi.fn().mockResolvedValue([]),
  addSuperAdmin: vi.fn(),
  removeSuperAdmin: vi.fn(),
}));

// テスト用アプリ作成ヘルパー
async function createTestApp() {
  const { superAdminRouter } = await import("./super-admin.js");

  const app = express();
  app.use(express.json());
  app.use("/", superAdminRouter);
  return app;
}

describe("super-admin router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PATCH /tenants/:id", () => {
    it("更新フィールドが指定されていない場合は400を返す", async () => {
      const app = await createTestApp();

      const res = await request(app).patch("/tenants/tenant-1").send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("no_fields");
    });

    it("組織名が空の場合は400を返す", async () => {
      const app = await createTestApp();

      const res = await request(app)
        .patch("/tenants/tenant-1")
        .send({ name: "" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_name");
    });

    it("組織名が100文字を超える場合は400を返す", async () => {
      const app = await createTestApp();

      const res = await request(app)
        .patch("/tenants/tenant-1")
        .send({ name: "a".repeat(101) });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_name");
    });

    it("無効なメールアドレス形式の場合は400を返す", async () => {
      const app = await createTestApp();

      const res = await request(app)
        .patch("/tenants/tenant-1")
        .send({ ownerEmail: "invalid-email" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_email");
    });

    it("無効なステータスの場合は400を返す", async () => {
      const app = await createTestApp();

      const res = await request(app)
        .patch("/tenants/tenant-1")
        .send({ status: "invalid" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_status");
    });

    it("テナントが存在しない場合は404を返す", async () => {
      const app = await createTestApp();
      mockFirestoreGet.mockResolvedValue({ exists: false });

      const res = await request(app)
        .patch("/tenants/non-existent")
        .send({ name: "New Name" });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("not_found");
    });

    it("変更がない場合は400を返す", async () => {
      const app = await createTestApp();
      mockFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => ({
          id: "tenant-1",
          name: "Same Name",
          ownerEmail: "owner@example.com",
          status: "active",
          createdAt: { toDate: () => new Date() },
          updatedAt: { toDate: () => new Date() },
        }),
      });

      const res = await request(app)
        .patch("/tenants/tenant-1")
        .send({ name: "Same Name" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("no_changes");
    });

    it("組織名を正常に更新できる", async () => {
      const app = await createTestApp();
      const now = new Date();

      mockFirestoreGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            id: "tenant-1",
            name: "Old Name",
            ownerId: "owner-uid",
            ownerEmail: "owner@example.com",
            status: "active",
            createdAt: { toDate: () => now },
            updatedAt: { toDate: () => now },
          }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            id: "tenant-1",
            name: "New Name",
            ownerId: "owner-uid",
            ownerEmail: "owner@example.com",
            status: "active",
            createdAt: { toDate: () => now },
            updatedAt: { toDate: () => now },
          }),
        });

      mockFirestoreUpdate.mockResolvedValue({});

      const res = await request(app)
        .patch("/tenants/tenant-1")
        .send({ name: "New Name" });

      expect(res.status).toBe(200);
      expect(res.body.tenant.name).toBe("New Name");
      expect(mockFirestoreUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Name",
          updatedAt: expect.any(Date),
        })
      );
    });

    it("オーナーメールを正常に更新できる", async () => {
      const app = await createTestApp();
      const now = new Date();

      mockFirestoreGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            id: "tenant-1",
            name: "Test Org",
            ownerId: "owner-uid",
            ownerEmail: "old@example.com",
            status: "active",
            createdAt: { toDate: () => now },
            updatedAt: { toDate: () => now },
          }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            id: "tenant-1",
            name: "Test Org",
            ownerId: "owner-uid",
            ownerEmail: "new@example.com",
            status: "active",
            createdAt: { toDate: () => now },
            updatedAt: { toDate: () => now },
          }),
        });

      mockFirestoreUpdate.mockResolvedValue({});

      const res = await request(app)
        .patch("/tenants/tenant-1")
        .send({ ownerEmail: "NEW@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.tenant.ownerEmail).toBe("new@example.com");
      expect(mockFirestoreUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerEmail: "new@example.com",
          updatedAt: expect.any(Date),
        })
      );
    });

    it("ステータスを正常に更新できる", async () => {
      const app = await createTestApp();
      const now = new Date();

      mockFirestoreGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            id: "tenant-1",
            name: "Test Org",
            ownerId: "owner-uid",
            ownerEmail: "owner@example.com",
            status: "active",
            createdAt: { toDate: () => now },
            updatedAt: { toDate: () => now },
          }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            id: "tenant-1",
            name: "Test Org",
            ownerId: "owner-uid",
            ownerEmail: "owner@example.com",
            status: "suspended",
            createdAt: { toDate: () => now },
            updatedAt: { toDate: () => now },
          }),
        });

      mockFirestoreUpdate.mockResolvedValue({});

      const res = await request(app)
        .patch("/tenants/tenant-1")
        .send({ status: "suspended" });

      expect(res.status).toBe(200);
      expect(res.body.tenant.status).toBe("suspended");
    });

    it("複数フィールドを同時に更新できる", async () => {
      const app = await createTestApp();
      const now = new Date();

      mockFirestoreGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            id: "tenant-1",
            name: "Old Name",
            ownerId: "owner-uid",
            ownerEmail: "old@example.com",
            status: "active",
            createdAt: { toDate: () => now },
            updatedAt: { toDate: () => now },
          }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            id: "tenant-1",
            name: "New Name",
            ownerId: "owner-uid",
            ownerEmail: "new@example.com",
            status: "suspended",
            createdAt: { toDate: () => now },
            updatedAt: { toDate: () => now },
          }),
        });

      mockFirestoreUpdate.mockResolvedValue({});

      const res = await request(app).patch("/tenants/tenant-1").send({
        name: "New Name",
        ownerEmail: "new@example.com",
        status: "suspended",
      });

      expect(res.status).toBe(200);
      expect(res.body.tenant.name).toBe("New Name");
      expect(res.body.tenant.ownerEmail).toBe("new@example.com");
      expect(res.body.tenant.status).toBe("suspended");
    });
  });

  describe("DELETE /tenants/:id", () => {
    it("テナントが存在しない場合は404を返す", async () => {
      const app = await createTestApp();
      mockFirestoreGet.mockResolvedValue({ exists: false });

      const res = await request(app).delete("/tenants/non-existent");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("not_found");
    });

    it("テナントを正常に削除できる", async () => {
      const app = await createTestApp();
      mockFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => ({
          id: "tenant-1",
          name: "Test Org",
          ownerEmail: "owner@example.com",
          status: "active",
        }),
      });
      mockRecursiveDelete.mockResolvedValue(undefined);

      const res = await request(app).delete("/tenants/tenant-1");

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("テナントを削除しました。");
      expect(res.body.deletedTenant.id).toBe("tenant-1");
      expect(res.body.deletedTenant.name).toBe("Test Org");
      expect(mockRecursiveDelete).toHaveBeenCalled();
    });

    it("recursiveDeleteが失敗した場合は500を返す", async () => {
      const app = await createTestApp();
      mockFirestoreGet.mockResolvedValue({
        exists: true,
        data: () => ({
          id: "tenant-1",
          name: "Test Org",
          ownerEmail: "owner@example.com",
          status: "active",
        }),
      });
      mockRecursiveDelete.mockRejectedValue(new Error("Firestore error"));

      const res = await request(app).delete("/tenants/tenant-1");

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("internal_error");
    });
  });
});
