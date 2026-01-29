/**
 * tenant.ts のユニットテスト
 *
 * テスト対象:
 * - tenantMiddleware - テナントID検証とコンテキスト設定
 * - demoAuthMiddleware - デモユーザー設定
 * - demoReadOnlyMiddleware - デモモード読み取り専用
 * - dataSourceErrorHandler - DataSourceエラーハンドリング
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import type { Request, Response, NextFunction } from "express";

// DataSourceのモック
vi.mock("../datasource/index.js", () => ({
  getDataSource: vi.fn((context) => ({
    tenantId: context.tenantId,
    isDemo: context.isDemo,
  })),
  ReadOnlyDataSourceError: class ReadOnlyDataSourceError extends Error {
    constructor(message = "Read-only data source") {
      super(message);
      this.name = "ReadOnlyDataSourceError";
    }
  },
}));

// テスト用リクエスト作成ヘルパー
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    params: {},
    method: "GET",
    user: undefined,
    tenantContext: undefined,
    dataSource: undefined,
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

describe("tenant middleware", () => {
  let tenantMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  let demoAuthMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  let demoReadOnlyMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  let dataSourceErrorHandler: (err: Error, req: Request, res: Response, next: NextFunction) => void;
  let ReadOnlyDataSourceError: new (message?: string) => Error;
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;

  beforeAll(async () => {
    vi.resetModules();
    const tenantModule = await import("./tenant.js");
    tenantMiddleware = tenantModule.tenantMiddleware;
    demoAuthMiddleware = tenantModule.demoAuthMiddleware;
    demoReadOnlyMiddleware = tenantModule.demoReadOnlyMiddleware;
    dataSourceErrorHandler = tenantModule.dataSourceErrorHandler;

    const dsModule = await import("../datasource/index.js");
    ReadOnlyDataSourceError = dsModule.ReadOnlyDataSourceError;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = vi.fn();
  });

  describe("tenantMiddleware", () => {
    it("有効なテナントIDでコンテキストを設定する", () => {
      mockReq.params.tenant = "my-tenant-123";

      tenantMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.tenantContext).toEqual({
        tenantId: "my-tenant-123",
        isDemo: false,
      });
      expect(mockReq.dataSource).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it("demoテナントIDでisDemoをtrueに設定する", () => {
      mockReq.params.tenant = "demo";

      tenantMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.tenantContext).toEqual({
        tenantId: "demo",
        isDemo: true,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it("空のテナントIDを拒否する", () => {
      mockReq.params.tenant = "";

      tenantMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "invalid_tenant_id",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("不正な文字を含むテナントIDを拒否する", () => {
      mockReq.params.tenant = "tenant@invalid!";

      tenantMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "invalid_tenant_id",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("65文字以上のテナントIDを拒否する", () => {
      mockReq.params.tenant = "a".repeat(65);

      tenantMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "invalid_tenant_id",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("64文字のテナントIDは許可する", () => {
      mockReq.params.tenant = "a".repeat(64);

      tenantMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.tenantContext?.tenantId).toBe("a".repeat(64));
      expect(mockNext).toHaveBeenCalled();
    });

    it("ハイフンとアンダースコアを含むテナントIDを許可する", () => {
      mockReq.params.tenant = "my_tenant-123";

      tenantMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.tenantContext?.tenantId).toBe("my_tenant-123");
      expect(mockNext).toHaveBeenCalled();
    });

    it("配列形式のテナントIDを処理する（Express 5対応）", () => {
      mockReq.params.tenant = ["first-tenant", "second-tenant"] as unknown as string;

      tenantMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.tenantContext?.tenantId).toBe("first-tenant");
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("demoAuthMiddleware", () => {
    it("デモテナントの場合、デモユーザーを設定する", () => {
      mockReq.tenantContext = { tenantId: "demo", isDemo: true };

      demoAuthMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.user).toEqual({
        id: "demo-admin",
        role: "admin",
        email: "admin@demo.example.com",
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it("通常テナントの場合、ユーザーを設定しない", () => {
      mockReq.tenantContext = { tenantId: "normal", isDemo: false };

      demoAuthMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it("テナントコンテキストがない場合、ユーザーを設定しない", () => {
      demoAuthMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("demoReadOnlyMiddleware", () => {
    it("デモモードでGETリクエストを許可する", () => {
      mockReq.tenantContext = { tenantId: "demo", isDemo: true };
      mockReq.method = "GET";

      demoReadOnlyMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("デモモードでPOSTリクエストをブロックする", () => {
      mockReq.tenantContext = { tenantId: "demo", isDemo: true };
      mockReq.method = "POST";

      demoReadOnlyMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "demo_read_only",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("デモモードでPATCHリクエストをブロックする", () => {
      mockReq.tenantContext = { tenantId: "demo", isDemo: true };
      mockReq.method = "PATCH";

      demoReadOnlyMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("デモモードでDELETEリクエストをブロックする", () => {
      mockReq.tenantContext = { tenantId: "demo", isDemo: true };
      mockReq.method = "DELETE";

      demoReadOnlyMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("デモモードでPUTリクエストをブロックする", () => {
      mockReq.tenantContext = { tenantId: "demo", isDemo: true };
      mockReq.method = "PUT";

      demoReadOnlyMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("通常テナントでPOSTリクエストを許可する", () => {
      mockReq.tenantContext = { tenantId: "normal", isDemo: false };
      mockReq.method = "POST";

      demoReadOnlyMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe("dataSourceErrorHandler", () => {
    it("ReadOnlyDataSourceErrorを403で処理する", () => {
      const error = new ReadOnlyDataSourceError("Read-only");

      dataSourceErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "read_only",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("その他のエラーは次のエラーハンドラに渡す", () => {
      const error = new Error("Unknown error");

      dataSourceErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
