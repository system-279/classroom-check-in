/**
 * auth.ts のユニットテスト
 *
 * テスト対象:
 * - requireUser ミドルウェア
 * - requireAdmin ミドルウェア
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requireUser, requireAdmin } from "./auth.js";

// テスト用リクエスト作成ヘルパー
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    header: vi.fn(),
    user: undefined,
    ...overrides,
  } as unknown as Request;
}

function createMockResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe("auth middleware", () => {
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = vi.fn();
  });

  describe("requireUser", () => {
    it("ユーザーが設定されていればnextを呼ぶ", () => {
      mockReq.user = { id: "user-123", role: "student" };

      requireUser(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("ユーザーが設定されていなければ401を返す", () => {
      requireUser(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "unauthorized" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("requireAdmin", () => {
    it("管理者ユーザーであればnextを呼ぶ", () => {
      mockReq.user = { id: "admin-123", role: "admin" };

      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("学生ユーザーであれば403を返す", () => {
      mockReq.user = { id: "student-123", role: "student" };

      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "forbidden" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("ユーザーが設定されていなければ401を返す", () => {
      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "unauthorized" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
