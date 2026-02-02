/**
 * auth-errors.ts のユニットテスト
 *
 * テスト対象:
 * - GET /admin/auth-errors: 認証エラーログ一覧取得
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import express from "express";
import request from "supertest";

// vi.hoisted でモック関数をホイスト前に定義
const mockDataSource = vi.hoisted(() => ({
  getAuthErrorLogs: vi.fn(),
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
  const { authErrorsRouter } = await import("./auth-errors.js");

  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    if (user) {
      req.user = user as Express.Request["user"];
    }
    req.dataSource = mockDataSource as unknown as Express.Request["dataSource"];
    next();
  });

  app.use("/", authErrorsRouter);
  return app;
}

describe("auth-errors router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /admin/auth-errors", () => {
    it("管理者は認証エラーログ一覧を取得できる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const logs = [
        {
          id: "log-1",
          email: "unauthorized@example.com",
          tenantId: "tenant-1",
          errorType: "tenant_access_denied",
          errorMessage: "Access denied",
          path: "/api/v1/courses",
          method: "GET",
          userAgent: "Mozilla/5.0",
          ipAddress: "192.168.1.1",
          occurredAt: new Date("2026-01-01T10:00:00Z"),
        },
      ];
      mockDataSource.getAuthErrorLogs.mockResolvedValue(logs);

      const res = await request(app).get("/admin/auth-errors");

      expect(res.status).toBe(200);
      expect(res.body.authErrorLogs).toHaveLength(1);
      expect(res.body.authErrorLogs[0].email).toBe("unauthorized@example.com");
      expect(res.body.authErrorLogs[0].errorType).toBe("tenant_access_denied");
    });

    it("学生は403を返す", async () => {
      const app = await createTestApp({ id: "user-1", role: "student" });

      const res = await request(app).get("/admin/auth-errors");

      expect(res.status).toBe(403);
    });

    it("未認証は401を返す", async () => {
      const app = await createTestApp();

      const res = await request(app).get("/admin/auth-errors");

      expect(res.status).toBe(401);
    });

    it("メールアドレスでフィルタできる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      mockDataSource.getAuthErrorLogs.mockResolvedValue([]);

      const res = await request(app).get("/admin/auth-errors?email=test@example.com");

      expect(res.status).toBe(200);
      expect(mockDataSource.getAuthErrorLogs).toHaveBeenCalledWith(
        expect.objectContaining({ email: "test@example.com" })
      );
    });

    it("日付範囲でフィルタできる", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      mockDataSource.getAuthErrorLogs.mockResolvedValue([]);

      const res = await request(app).get(
        "/admin/auth-errors?startDate=2026-01-01T00:00:00Z&endDate=2026-01-31T23:59:59Z"
      );

      expect(res.status).toBe(200);
      expect(mockDataSource.getAuthErrorLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      );
    });

    it("不正なstartDateは400を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const res = await request(app).get("/admin/auth-errors?startDate=invalid");

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("invalid_start_date");
    });

    it("不正なendDateは400を返す", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      const res = await request(app).get("/admin/auth-errors?endDate=invalid");

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("invalid_end_date");
    });

    it("limitパラメータが適用される", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      mockDataSource.getAuthErrorLogs.mockResolvedValue([]);

      const res = await request(app).get("/admin/auth-errors?limit=50");

      expect(res.status).toBe(200);
      expect(mockDataSource.getAuthErrorLogs).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 })
      );
    });

    it("limitが500を超える場合は500に制限される", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      mockDataSource.getAuthErrorLogs.mockResolvedValue([]);

      const res = await request(app).get("/admin/auth-errors?limit=1000");

      expect(res.status).toBe(200);
      expect(mockDataSource.getAuthErrorLogs).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 500 })
      );
    });

    it("limitが不正な場合はデフォルト100が適用される", async () => {
      const app = await createTestApp({ id: "admin-1", role: "admin" });

      mockDataSource.getAuthErrorLogs.mockResolvedValue([]);

      const res = await request(app).get("/admin/auth-errors?limit=invalid");

      expect(res.status).toBe(200);
      expect(mockDataSource.getAuthErrorLogs).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      );
    });
  });
});
