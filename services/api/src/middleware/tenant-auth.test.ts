/**
 * tenant-auth.ts のユニットテスト
 *
 * テスト対象:
 * - テナント内ユーザー検索がスーパー管理者チェックより優先されること
 * - firebaseUid → メールアドレス → スーパー管理者 → 許可リストの順で処理
 */

import { describe, it, expect, vi, beforeEach, beforeAll, type Mock } from "vitest";
import type { Request, Response, NextFunction } from "express";

// vi.hoisted でモック関数をホイスト前に定義
const { mockVerifyIdToken, mockIsSuperAdmin } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockIsSuperAdmin: vi.fn(),
}));

// モック設定（ESモジュール対応）
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

vi.mock("./super-admin.js", () => ({
  isSuperAdmin: mockIsSuperAdmin,
}));

// DataSource のモック型
type MockDataSource = {
  getUserByFirebaseUid: Mock;
  getUserByEmail: Mock;
  updateUser: Mock;
  isEmailAllowed: Mock;
  createUser: Mock;
};

// テスト用リクエスト作成ヘルパー
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    header: vi.fn(),
    dataSource: undefined,
    user: undefined,
    tenantContext: { tenantId: "test-tenant" },
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

function createMockDataSource(): MockDataSource {
  return {
    getUserByFirebaseUid: vi.fn(),
    getUserByEmail: vi.fn(),
    updateUser: vi.fn(),
    isEmailAllowed: vi.fn(),
    createUser: vi.fn(),
  };
}

describe("tenantAwareAuthMiddleware", () => {
  let tenantAwareAuthMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;
  let mockDataSource: MockDataSource;

  beforeAll(async () => {
    // Firebase認証モードを設定してからモジュールをインポート
    process.env.AUTH_MODE = "firebase";
    vi.resetModules();
    const module = await import("./tenant-auth.js");
    tenantAwareAuthMiddleware = module.tenantAwareAuthMiddleware as typeof tenantAwareAuthMiddleware;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataSource = createMockDataSource();
    mockReq = createMockRequest({
      dataSource: mockDataSource as unknown as Request["dataSource"],
    });
    mockRes = createMockResponse();
    mockNext = vi.fn();
  });

  describe("Firebase認証モード", () => {
    beforeEach(() => {
      // Authorization ヘッダーを設定
      (mockReq.header as Mock).mockImplementation((name: string) => {
        if (name === "authorization") return "Bearer valid-token";
        return undefined;
      });
    });

    it("firebaseUidで既存ユーザーが見つかれば、そのユーザーを返す", async () => {
      const existingUser = {
        id: "user-123",
        email: "user@example.com",
        role: "student",
        firebaseUid: "firebase-uid-123",
      };

      // Firebase トークン検証モック
      mockVerifyIdToken.mockResolvedValue({
        uid: "firebase-uid-123",
        email: "user@example.com",
      });

      // DataSource モック
      mockDataSource.getUserByFirebaseUid.mockResolvedValue(existingUser);

      await tenantAwareAuthMiddleware(mockReq, mockRes, mockNext);

      expect(mockDataSource.getUserByFirebaseUid).toHaveBeenCalledWith("firebase-uid-123");
      expect(mockReq.user).toEqual({
        id: "user-123",
        role: "student",
        email: "user@example.com",
        firebaseUid: "firebase-uid-123",
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it("firebaseUidで見つからずメールで見つかれば、firebaseUidを設定して返す", async () => {
      const existingUser = {
        id: "user-456",
        email: "user@example.com",
        role: "admin",
        firebaseUid: null,
      };

      mockVerifyIdToken.mockResolvedValue({
        uid: "new-firebase-uid",
        email: "user@example.com",
      });

      mockDataSource.getUserByFirebaseUid.mockResolvedValue(null);
      mockDataSource.getUserByEmail.mockResolvedValue(existingUser);

      await tenantAwareAuthMiddleware(mockReq, mockRes, mockNext);

      expect(mockDataSource.getUserByFirebaseUid).toHaveBeenCalledWith("new-firebase-uid");
      expect(mockDataSource.getUserByEmail).toHaveBeenCalledWith("user@example.com");
      expect(mockDataSource.updateUser).toHaveBeenCalledWith("user-456", {
        firebaseUid: "new-firebase-uid",
      });
      expect(mockReq.user).toEqual({
        id: "user-456",
        role: "admin",
        email: "user@example.com",
        firebaseUid: "new-firebase-uid",
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it("テナント内にユーザーがいない場合、スーパー管理者ならsuper-admin-{uid}を返す", async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: "super-admin-uid",
        email: "superadmin@example.com",
      });

      mockDataSource.getUserByFirebaseUid.mockResolvedValue(null);
      mockDataSource.getUserByEmail.mockResolvedValue(null);
      mockIsSuperAdmin.mockResolvedValue(true);

      await tenantAwareAuthMiddleware(mockReq, mockRes, mockNext);

      expect(mockDataSource.getUserByFirebaseUid).toHaveBeenCalled();
      expect(mockDataSource.getUserByEmail).toHaveBeenCalled();
      expect(mockIsSuperAdmin).toHaveBeenCalledWith("superadmin@example.com");
      expect(mockReq.user).toEqual({
        id: "super-admin-super-admin-uid",
        role: "admin",
        email: "superadmin@example.com",
        firebaseUid: "super-admin-uid",
        isSuperAdminAccess: true,
      });
      expect(mockReq.isSuperAdminAccess).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it("スーパー管理者でもテナント内にユーザーがいれば、そのユーザーを優先する", async () => {
      const tenantUser = {
        id: "tenant-user-789",
        email: "superadmin@example.com",
        role: "student",
        firebaseUid: "super-admin-uid",
      };

      mockVerifyIdToken.mockResolvedValue({
        uid: "super-admin-uid",
        email: "superadmin@example.com",
      });

      // スーパー管理者だがテナント内にユーザーが存在
      mockDataSource.getUserByFirebaseUid.mockResolvedValue(tenantUser);
      mockIsSuperAdmin.mockResolvedValue(true);

      await tenantAwareAuthMiddleware(mockReq, mockRes, mockNext);

      // firebaseUidで見つかったのでスーパー管理者チェックは呼ばれない
      expect(mockIsSuperAdmin).not.toHaveBeenCalled();
      expect(mockReq.user).toEqual({
        id: "tenant-user-789",
        role: "student",
        email: "superadmin@example.com",
        firebaseUid: "super-admin-uid",
      });
      // スーパー管理者としてではなく通常ユーザーとして認証
      expect(mockReq.isSuperAdminAccess).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it("新規ユーザーで許可リストに含まれない場合は403を返す", async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: "new-user-uid",
        email: "newuser@example.com",
      });

      mockDataSource.getUserByFirebaseUid.mockResolvedValue(null);
      mockDataSource.getUserByEmail.mockResolvedValue(null);
      mockIsSuperAdmin.mockResolvedValue(false);
      mockDataSource.isEmailAllowed.mockResolvedValue(false);

      await tenantAwareAuthMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "tenant_access_denied",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("新規ユーザーで許可リストに含まれる場合はユーザーを作成", async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: "new-user-uid",
        email: "allowed@example.com",
        name: "New User",
      });

      const createdUser = {
        id: "created-user-id",
        email: "allowed@example.com",
        role: "student",
        firebaseUid: "new-user-uid",
      };

      mockDataSource.getUserByFirebaseUid.mockResolvedValue(null);
      mockDataSource.getUserByEmail.mockResolvedValue(null);
      mockIsSuperAdmin.mockResolvedValue(false);
      mockDataSource.isEmailAllowed.mockResolvedValue(true);
      mockDataSource.createUser.mockResolvedValue(createdUser);

      await tenantAwareAuthMiddleware(mockReq, mockRes, mockNext);

      expect(mockDataSource.createUser).toHaveBeenCalledWith({
        email: "allowed@example.com",
        name: "New User",
        role: "student",
        firebaseUid: "new-user-uid",
      });
      expect(mockReq.user).toEqual({
        id: "created-user-id",
        role: "student",
        email: "allowed@example.com",
        firebaseUid: "new-user-uid",
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("DataSourceが設定されていない場合", () => {
    it("500エラーを返す", async () => {
      mockReq = createMockRequest({ dataSource: undefined });

      await tenantAwareAuthMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "internal_error",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("Authorizationヘッダーがない場合", () => {
    it("ユーザーを設定せずnextを呼ぶ", async () => {
      (mockReq.header as Mock).mockReturnValue(undefined);

      await tenantAwareAuthMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
