/**
 * super-admin.ts のユニットテスト
 *
 * テスト対象:
 * - isSuperAdmin - 環境変数とFirestoreの両方チェック
 * - superAdminAuthMiddleware - スーパー管理者認可
 */

import { describe, it, expect, vi, beforeEach, beforeAll, type Mock } from "vitest";
import type { Request, Response, NextFunction } from "express";

// vi.hoisted でモック関数をホイスト前に定義
const { mockFirestoreGet, mockVerifyIdToken } = vi.hoisted(() => ({
  mockFirestoreGet: vi.fn(),
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

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      get: mockFirestoreGet,
      doc: vi.fn(() => ({
        set: vi.fn(),
        delete: vi.fn(),
      })),
    })),
  })),
}));

// テスト用リクエスト作成ヘルパー
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    header: vi.fn(),
    superAdmin: undefined,
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

describe("super-admin middleware", () => {
  describe("devモード", () => {
    let isSuperAdmin: (email: string | undefined) => Promise<boolean>;
    let superAdminAuthMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<Response | void>;
    let mockReq: Request;
    let mockRes: Response;
    let mockNext: NextFunction;

    beforeAll(async () => {
      // 環境変数を設定してからモジュールをインポート
      process.env.AUTH_MODE = "dev";
      process.env.SUPER_ADMIN_EMAILS = "admin@example.com,super@example.com";
      vi.resetModules();
      const module = await import("./super-admin.js");
      isSuperAdmin = module.isSuperAdmin;
      superAdminAuthMiddleware = module.superAdminAuthMiddleware;
    });

    beforeEach(() => {
      vi.clearAllMocks();
      mockReq = createMockRequest();
      mockRes = createMockResponse();
      mockNext = vi.fn();

      // デフォルトでFirestoreは空を返す
      mockFirestoreGet.mockResolvedValue({ docs: [] });
    });

    describe("isSuperAdmin", () => {
      it("環境変数に含まれるメールアドレスはtrueを返す", async () => {
        expect(await isSuperAdmin("admin@example.com")).toBe(true);
        expect(await isSuperAdmin("super@example.com")).toBe(true);
      });

      it("大文字小文字を区別しない", async () => {
        expect(await isSuperAdmin("ADMIN@EXAMPLE.COM")).toBe(true);
        expect(await isSuperAdmin("Admin@Example.Com")).toBe(true);
      });

      it("環境変数に含まれないメールアドレスはFirestoreをチェックする", async () => {
        mockFirestoreGet.mockResolvedValue({
          docs: [{ id: "firestore-admin@example.com" }],
        });

        expect(await isSuperAdmin("firestore-admin@example.com")).toBe(true);
      });

      it("どちらにも含まれないメールアドレスはfalseを返す", async () => {
        mockFirestoreGet.mockResolvedValue({ docs: [] });

        expect(await isSuperAdmin("unknown@example.com")).toBe(false);
      });

      it("undefinedはfalseを返す", async () => {
        expect(await isSuperAdmin(undefined)).toBe(false);
      });

      it("空文字列はfalseを返す", async () => {
        expect(await isSuperAdmin("")).toBe(false);
      });
    });

    describe("superAdminAuthMiddleware (devモード)", () => {
      it("X-User-Emailヘッダがスーパー管理者なら認可する", async () => {
        (mockReq.header as Mock).mockImplementation((name: string) => {
          if (name === "x-user-email") return "admin@example.com";
          return undefined;
        });

        await superAdminAuthMiddleware(mockReq, mockRes, mockNext);

        expect(mockReq.superAdmin).toEqual({
          email: "admin@example.com",
        });
        expect(mockNext).toHaveBeenCalled();
      });

      it("X-User-Emailヘッダがない場合は401を返す", async () => {
        (mockReq.header as Mock).mockReturnValue(undefined);

        await superAdminAuthMiddleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: "unauthorized",
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      it("スーパー管理者でないメールアドレスは403を返す", async () => {
        (mockReq.header as Mock).mockImplementation((name: string) => {
          if (name === "x-user-email") return "normal-user@example.com";
          return undefined;
        });
        mockFirestoreGet.mockResolvedValue({ docs: [] });

        await superAdminAuthMiddleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: "forbidden",
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });

  describe("firebaseモード", () => {
    let superAdminAuthMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<Response | void>;
    let mockReq: Request;
    let mockRes: Response;
    let mockNext: NextFunction;

    beforeAll(async () => {
      // Firebase認証モードを設定してからモジュールをインポート
      process.env.AUTH_MODE = "firebase";
      process.env.SUPER_ADMIN_EMAILS = "admin@example.com";
      vi.resetModules();
      const module = await import("./super-admin.js");
      superAdminAuthMiddleware = module.superAdminAuthMiddleware;
    });

    beforeEach(() => {
      vi.clearAllMocks();
      mockReq = createMockRequest();
      mockRes = createMockResponse();
      mockNext = vi.fn();

      mockFirestoreGet.mockResolvedValue({ docs: [] });
    });

    it("Authorizationヘッダがない場合は401を返す", async () => {
      (mockReq.header as Mock).mockReturnValue(undefined);

      await superAdminAuthMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "unauthorized",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("Bearer形式でない場合は401を返す", async () => {
      (mockReq.header as Mock).mockImplementation((name: string) => {
        if (name === "authorization") return "Basic token";
        return undefined;
      });

      await superAdminAuthMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("有効なトークンでスーパー管理者なら認可する", async () => {
      (mockReq.header as Mock).mockImplementation((name: string) => {
        if (name === "authorization") return "Bearer valid-token";
        return undefined;
      });

      mockVerifyIdToken.mockResolvedValue({
        uid: "firebase-uid",
        email: "admin@example.com",
      });

      await superAdminAuthMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.superAdmin).toEqual({
        email: "admin@example.com",
        firebaseUid: "firebase-uid",
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it("有効なトークンでもスーパー管理者でなければ403を返す", async () => {
      (mockReq.header as Mock).mockImplementation((name: string) => {
        if (name === "authorization") return "Bearer valid-token";
        return undefined;
      });

      mockVerifyIdToken.mockResolvedValue({
        uid: "firebase-uid",
        email: "normal-user@example.com",
      });

      await superAdminAuthMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "forbidden",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("トークン検証に失敗した場合は401を返す", async () => {
      (mockReq.header as Mock).mockImplementation((name: string) => {
        if (name === "authorization") return "Bearer invalid-token";
        return undefined;
      });

      mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

      await superAdminAuthMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "unauthorized",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
