/**
 * allowed-emails.ts のユニットテスト
 *
 * テスト対象:
 * - GET /admin/allowed-emails: 許可メール一覧
 * - POST /admin/allowed-emails: 許可メール追加（バリデーション、重複チェック）
 * - DELETE /admin/allowed-emails/:id: 許可メール削除
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import express from "express";
import request from "supertest";

// vi.hoisted でモック関数をホイスト前に定義
const mockDataSource = vi.hoisted(() => ({
  getAllowedEmails: vi.fn(),
  getAllowedEmailById: vi.fn(),
  isEmailAllowed: vi.fn(),
  createAllowedEmail: vi.fn(),
  deleteAllowedEmail: vi.fn(),
}));

// モック設定
vi.mock("../../middleware/auth.js", () => ({
  requireAdmin: (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "unauthorized" });
    }
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  },
}));

// テスト用アプリ作成ヘルパー
async function createTestApp(user?: { id: string; role: string }) {
  const { allowedEmailsRouter } = await import("./allowed-emails.js");

  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    if (user) {
      req.user = user as Express.Request["user"];
    }
    req.dataSource = mockDataSource as unknown as Express.Request["dataSource"];
    next();
  });

  app.use("/", allowedEmailsRouter);
  return app;
}

describe("allowed-emails router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /admin/allowed-emails", () => {
    it("管理者は許可メール一覧を取得できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const emails = [
        {
          id: "email-1",
          email: "user@example.com",
          note: "テストユーザー",
          createdAt: new Date("2026-01-01"),
        },
      ];
      mockDataSource.getAllowedEmails.mockResolvedValue(emails);

      const res = await request(app).get("/admin/allowed-emails");

      expect(res.status).toBe(200);
      expect(res.body.allowedEmails).toHaveLength(1);
      expect(res.body.allowedEmails[0].email).toBe("user@example.com");
    });

    it("学生は403を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });

      const res = await request(app).get("/admin/allowed-emails");

      expect(res.status).toBe(403);
    });
  });

  describe("POST /admin/allowed-emails", () => {
    it("許可メールを追加できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      mockDataSource.isEmailAllowed.mockResolvedValue(false);
      const newEmail = {
        id: "email-new",
        email: "new@example.com",
        note: "新規追加",
        createdAt: new Date(),
      };
      mockDataSource.createAllowedEmail.mockResolvedValue(newEmail);

      const res = await request(app)
        .post("/admin/allowed-emails")
        .send({ email: "new@example.com", note: "新規追加" });

      expect(res.status).toBe(201);
      expect(res.body.allowedEmail.email).toBe("new@example.com");
    });

    it("無効なメールアドレスは400を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const res = await request(app)
        .post("/admin/allowed-emails")
        .send({ email: "invalid-email" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_email");
    });

    it("メールアドレスがない場合は400を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const res = await request(app).post("/admin/allowed-emails").send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("invalid_email");
    });

    it("重複するメールアドレスは409を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.isEmailAllowed.mockResolvedValue(true);

      const res = await request(app)
        .post("/admin/allowed-emails")
        .send({ email: "existing@example.com" });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe("email_exists");
    });
  });

  describe("DELETE /admin/allowed-emails/:id", () => {
    it("許可メールを削除できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getAllowedEmailById.mockResolvedValue({ id: "email-1" });
      mockDataSource.deleteAllowedEmail.mockResolvedValue(undefined);

      const res = await request(app).delete("/admin/allowed-emails/email-1");

      expect(res.status).toBe(204);
      expect(mockDataSource.deleteAllowedEmail).toHaveBeenCalledWith("email-1");
    });

    it("存在しない許可メールは404を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });
      mockDataSource.getAllowedEmailById.mockResolvedValue(null);

      const res = await request(app).delete("/admin/allowed-emails/invalid");

      expect(res.status).toBe(404);
    });
  });
});
