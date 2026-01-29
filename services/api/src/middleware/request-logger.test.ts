/**
 * リクエストログミドルウェアのテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import { requestLogger, generateRequestId } from "./request-logger.js";

describe("request-logger middleware", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-29T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("generateRequestId", () => {
    it("一意なリクエストIDを生成する", () => {
      const id1 = generateRequestId();
      vi.advanceTimersByTime(1);
      const id2 = generateRequestId();

      expect(id1).toMatch(/^req-[a-z0-9]+$/);
      expect(id2).toMatch(/^req-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("requestLogger", () => {
    const mockRequest = (overrides: Partial<Request> = {}): Request =>
      ({
        method: "GET",
        path: "/api/test",
        headers: {},
        query: {},
        ...overrides,
      }) as Request;

    const mockResponse = (): Response => {
      const res = {
        statusCode: 200,
        on: vi.fn((event: string, callback: () => void) => {
          if (event === "finish") {
            // 即座にfinishイベントを発火
            setTimeout(callback, 0);
          }
          return res;
        }),
      } as unknown as Response;
      return res;
    };

    it("リクエスト開始時にログを出力する", () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = vi.fn() as NextFunction;

      requestLogger(req, res, next);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(output.level).toBe("info");
      expect(output.message).toBe("Request started");
      expect(output.method).toBe("GET");
      expect(output.path).toBe("/api/test");
      expect(output.requestId).toBeDefined();
    });

    it("リクエストIDをreqオブジェクトに設定する", () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = vi.fn() as NextFunction;

      requestLogger(req, res, next);

      expect(req.requestId).toBeDefined();
      expect(req.requestId).toMatch(/^req-/);
    });

    it("既存のリクエストIDがあれば使用する", () => {
      const req = mockRequest({
        headers: { "x-request-id": "existing-id" },
      });
      const res = mockResponse();
      const next = vi.fn() as NextFunction;

      requestLogger(req, res, next);

      expect(req.requestId).toBe("existing-id");
    });

    it("nextを呼び出す", () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = vi.fn() as NextFunction;

      requestLogger(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("レスポンス完了時にログを出力する", async () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = vi.fn() as NextFunction;

      requestLogger(req, res, next);

      // finishイベントを発火させる
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // 2回呼ばれる（開始と完了）
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);

      const finishOutput = JSON.parse(consoleLogSpy.mock.calls[1][0]);
      expect(finishOutput.message).toBe("Request completed");
      expect(finishOutput.statusCode).toBe(200);
      expect(finishOutput.durationMs).toBeDefined();
    });

    it("テナントIDがあればログに含める", () => {
      const req = mockRequest();
      (req as Request & { tenantId?: string }).tenantId = "tenant-123";
      const res = mockResponse();
      const next = vi.fn() as NextFunction;

      requestLogger(req, res, next);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.tenantId).toBe("tenant-123");
    });

    it("ユーザーIDがあればログに含める", () => {
      const req = mockRequest();
      (req as Request & { user?: { id: string } }).user = { id: "user-456" };
      const res = mockResponse();
      const next = vi.fn() as NextFunction;

      requestLogger(req, res, next);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.userId).toBe("user-456");
    });
  });
});
