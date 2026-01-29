/**
 * 構造化ログユーティリティのテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, LogLevel } from "./logger.js";

describe("logger", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("基本機能", () => {
    it("infoログを出力できる", () => {
      logger.info("Test message");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(output.level).toBe("info");
      expect(output.message).toBe("Test message");
      expect(output.timestamp).toBeDefined();
    });

    it("errorログを出力できる", () => {
      logger.error("Error message");

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(output.level).toBe("error");
      expect(output.message).toBe("Error message");
    });

    it("warnログを出力できる", () => {
      logger.warn("Warning message");

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleWarnSpy.mock.calls[0][0]);

      expect(output.level).toBe("warn");
      expect(output.message).toBe("Warning message");
    });

    it("debugログを出力できる", () => {
      logger.debug("Debug message");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(output.level).toBe("debug");
      expect(output.message).toBe("Debug message");
    });
  });

  describe("メタデータ", () => {
    it("追加のメタデータを含められる", () => {
      logger.info("User action", { userId: "user-123", action: "login" });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(output.userId).toBe("user-123");
      expect(output.action).toBe("login");
    });

    it("リクエストIDを含められる", () => {
      logger.info("Request received", { requestId: "req-abc" });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(output.requestId).toBe("req-abc");
    });

    it("エラーオブジェクトをシリアライズできる", () => {
      const error = new Error("Test error");
      logger.error("Operation failed", { error });

      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(output.error).toBeDefined();
      expect(output.error.message).toBe("Test error");
      expect(output.error.stack).toBeDefined();
    });
  });

  describe("子ロガー", () => {
    it("コンテキスト付きの子ロガーを作成できる", () => {
      const childLogger = logger.child({ service: "api", tenantId: "tenant-1" });
      childLogger.info("Child log");

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(output.service).toBe("api");
      expect(output.tenantId).toBe("tenant-1");
      expect(output.message).toBe("Child log");
    });

    it("子ロガーのコンテキストに追加できる", () => {
      const childLogger = logger.child({ service: "api" });
      childLogger.info("Request", { requestId: "req-123" });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(output.service).toBe("api");
      expect(output.requestId).toBe("req-123");
    });
  });

  describe("ログレベル定数", () => {
    it("全てのログレベルが定義されている", () => {
      expect(LogLevel.DEBUG).toBe("debug");
      expect(LogLevel.INFO).toBe("info");
      expect(LogLevel.WARN).toBe("warn");
      expect(LogLevel.ERROR).toBe("error");
    });
  });
});
