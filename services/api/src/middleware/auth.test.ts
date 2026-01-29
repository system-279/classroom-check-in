/**
 * auth.ts のユニットテスト
 *
 * テスト対象:
 * - devモードでのヘッダ疑似認証
 * - requireUser ミドルウェア
 * - requireAdmin ミドルウェア
 * - AccessDeniedError
 */

import { describe, it, expect, vi, beforeEach, beforeAll, type Mock } from "vitest";
import type { Request, Response, NextFunction } from "express";

// vi.hoisted でモック関数をホイスト前に定義
const { mockFirestoreGet, mockFirestoreAdd, mockVerifyIdToken } = vi.hoisted(() => ({
  mockFirestoreGet: vi.fn(),
  mockFirestoreAdd: vi.fn(),
  mockVerifyIdToken: vi.fn(),
}));

// モック設定
vi.mock("firebase-admin/app", () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(),
  cert: vi.fn(),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

vi.mock("../storage/firestore.js", () => ({
  db: {
    collection: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => ({
          get: mockFirestoreGet,
        })),
      })),
      add: mockFirestoreAdd,
    })),
  },
}));

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
  describe("devモード", () => {
    let authMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    let requireUser: (req: Request, res: Response, next: NextFunction) => void;
    let requireAdmin: (req: Request, res: Response, next: NextFunction) => void;
    let AccessDeniedError: new (message: string) => Error;
    let mockReq: Request;
    let mockRes: Response;
    let mockNext: NextFunction;

    beforeAll(async () => {
      // devモードを設定してからモジュールをインポート
      process.env.AUTH_MODE = "dev";
      vi.resetModules();
      const module = await import("./auth.js");
      authMiddleware = module.authMiddleware as typeof authMiddleware;
      requireUser = module.requireUser;
      requireAdmin = module.requireAdmin;
      AccessDeniedError = module.AccessDeniedError;
    });

    beforeEach(() => {
      vi.clearAllMocks();
      mockReq = createMockRequest();
      mockRes = createMockResponse();
      mockNext = vi.fn();
    });

    describe("authMiddleware", () => {
      it("X-User-Idヘッダがあればユーザーを設定する", async () => {
        (mockReq.header as Mock).mockImplementation((name: string) => {
          if (name === "x-user-id") return "user-123";
          if (name === "x-user-role") return "student";
          if (name === "x-user-email") return "user@example.com";
          return undefined;
        });

        await authMiddleware(mockReq, mockRes, mockNext);

        expect(mockReq.user).toEqual({
          id: "user-123",
          role: "student",
          email: "user@example.com",
        });
        expect(mockNext).toHaveBeenCalled();
      });

      it("X-User-Roleが省略されればデフォルトでstudentになる", async () => {
        (mockReq.header as Mock).mockImplementation((name: string) => {
          if (name === "x-user-id") return "user-456";
          return undefined;
        });

        await authMiddleware(mockReq, mockRes, mockNext);

        expect(mockReq.user).toEqual({
          id: "user-456",
          role: "student",
          email: undefined,
        });
        expect(mockNext).toHaveBeenCalled();
      });

      it("X-User-Idがなければユーザーを設定しない", async () => {
        (mockReq.header as Mock).mockReturnValue(undefined);

        await authMiddleware(mockReq, mockRes, mockNext);

        expect(mockReq.user).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
      });

      it("既にユーザーが設定されている場合はスキップする", async () => {
        mockReq.user = { id: "existing-user", role: "admin" };
        (mockReq.header as Mock).mockImplementation((name: string) => {
          if (name === "x-user-id") return "new-user";
          return undefined;
        });

        await authMiddleware(mockReq, mockRes, mockNext);

        expect(mockReq.user).toEqual({ id: "existing-user", role: "admin" });
        expect(mockNext).toHaveBeenCalled();
      });
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

    describe("AccessDeniedError", () => {
      it("正しいエラー名とメッセージを持つ", () => {
        const error = new AccessDeniedError("アクセスが拒否されました");

        expect(error.name).toBe("AccessDeniedError");
        expect(error.message).toBe("アクセスが拒否されました");
        expect(error).toBeInstanceOf(Error);
      });
    });
  });
});
