/**
 * グローバルエラーハンドラーのユニットテスト
 */

import { describe, it, expect, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { errorHandler, notFoundHandler } from "./error-handler.js";
import { AppError, NotFoundError, ErrorCode } from "../utils/errors.js";

describe("error-handler middleware", () => {
  const mockRequest = () => ({} as Request);
  const mockResponse = () => {
    const res = {} as Response;
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };
  const mockNext = vi.fn() as NextFunction;

  describe("errorHandler", () => {
    it("AppErrorを適切なレスポンスに変換する", () => {
      const req = mockRequest();
      const res = mockResponse();
      const error = new NotFoundError("User not found");

      errorHandler(error, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: "NOT_FOUND",
          message: "User not found",
        },
      });
    });

    it("詳細情報付きAppErrorを変換する", () => {
      const req = mockRequest();
      const res = mockResponse();
      const error = new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Validation failed",
        400,
        { fields: { email: "Invalid email" } }
      );

      errorHandler(error, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: { fields: { email: "Invalid email" } },
        },
      });
    });

    it("通常のErrorを500エラーに変換する", () => {
      const req = mockRequest();
      const res = mockResponse();
      const error = new Error("Something went wrong");

      // エラーログをモック
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      errorHandler(error, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error",
        },
      });

      // 内部エラーはログに記録される
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("文字列エラーを500エラーに変換する", () => {
      const req = mockRequest();
      const res = mockResponse();

      vi.spyOn(console, "error").mockImplementation(() => {});

      errorHandler("Unexpected error", req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error",
        },
      });
    });
  });

  describe("notFoundHandler", () => {
    it("存在しないルートに対して404を返す", () => {
      const req = { method: "GET", path: "/unknown" } as Request;
      const res = mockResponse();

      notFoundHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: "NOT_FOUND",
          message: "Route GET /unknown not found",
        },
      });
    });
  });
});
