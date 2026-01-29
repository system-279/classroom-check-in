/**
 * エラーハンドリングのユニットテスト
 *
 * テスト対象:
 * - AppError クラス
 * - エラーコード定数
 * - エラーレスポンス形式
 */

import { describe, it, expect } from "vitest";
import {
  AppError,
  ErrorCode,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError,
} from "./errors.js";

describe("AppError", () => {
  describe("基本機能", () => {
    it("エラーコードとメッセージを保持する", () => {
      const error = new AppError(ErrorCode.NOT_FOUND, "Resource not found", 404);

      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("Resource not found");
      expect(error.statusCode).toBe(404);
      expect(error.details).toBeUndefined();
    });

    it("詳細情報を保持できる", () => {
      const details = { field: "email", reason: "invalid format" };
      const error = new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Validation failed",
        400,
        details
      );

      expect(error.details).toEqual(details);
    });

    it("JSON形式に変換できる", () => {
      const error = new AppError(ErrorCode.NOT_FOUND, "User not found", 404);
      const json = error.toJSON();

      expect(json).toEqual({
        error: {
          code: "NOT_FOUND",
          message: "User not found",
        },
      });
    });

    it("詳細情報付きでJSON形式に変換できる", () => {
      const details = { fields: { email: "Invalid email" } };
      const error = new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Validation failed",
        400,
        details
      );
      const json = error.toJSON();

      expect(json).toEqual({
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: { fields: { email: "Invalid email" } },
        },
      });
    });

    it("Errorを継承している", () => {
      const error = new AppError(ErrorCode.INTERNAL_ERROR, "Something went wrong", 500);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe("ヘルパークラス", () => {
    it("BadRequestError: 400エラーを作成", () => {
      const error = new BadRequestError("Invalid input");

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("INVALID_REQUEST");
    });

    it("BadRequestError: バリデーションエラーを作成", () => {
      const error = BadRequestError.validation({ name: "Name is required" });

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toEqual({ fields: { name: "Name is required" } });
    });

    it("UnauthorizedError: 401エラーを作成", () => {
      const error = new UnauthorizedError("Authentication required");

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe("UNAUTHORIZED");
    });

    it("UnauthorizedError: トークン期限切れエラーを作成", () => {
      const error = UnauthorizedError.tokenExpired();

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe("TOKEN_EXPIRED");
    });

    it("UnauthorizedError: トークン不正エラーを作成", () => {
      const error = UnauthorizedError.tokenInvalid();

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe("TOKEN_INVALID");
    });

    it("ForbiddenError: 403エラーを作成", () => {
      const error = new ForbiddenError("Access denied");

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe("FORBIDDEN");
    });

    it("NotFoundError: 404エラーを作成", () => {
      const error = new NotFoundError("User not found");

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("NOT_FOUND");
    });

    it("ConflictError: 409エラーを作成", () => {
      const error = new ConflictError("Resource already exists");

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe("CONFLICT");
    });

    it("ConflictError: 既存リソースエラーを作成", () => {
      const error = ConflictError.alreadyExists("User");

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe("ALREADY_EXISTS");
      expect(error.message).toBe("User already exists");
    });

    it("RateLimitError: 429エラーを作成", () => {
      const error = new RateLimitError();

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe("RATE_LIMIT_EXCEEDED");
    });

    it("InternalError: 500エラーを作成", () => {
      const error = new InternalError();

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("INTERNAL_ERROR");
    });
  });
});

describe("ErrorCode", () => {
  it("全てのエラーコードが定義されている", () => {
    expect(ErrorCode.INVALID_REQUEST).toBe("INVALID_REQUEST");
    expect(ErrorCode.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
    expect(ErrorCode.UNAUTHORIZED).toBe("UNAUTHORIZED");
    expect(ErrorCode.TOKEN_EXPIRED).toBe("TOKEN_EXPIRED");
    expect(ErrorCode.TOKEN_INVALID).toBe("TOKEN_INVALID");
    expect(ErrorCode.FORBIDDEN).toBe("FORBIDDEN");
    expect(ErrorCode.NOT_FOUND).toBe("NOT_FOUND");
    expect(ErrorCode.CONFLICT).toBe("CONFLICT");
    expect(ErrorCode.ALREADY_EXISTS).toBe("ALREADY_EXISTS");
    expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe("RATE_LIMIT_EXCEEDED");
    expect(ErrorCode.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
  });
});
