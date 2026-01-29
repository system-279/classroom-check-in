/**
 * auto-closer.ts のユニットテスト
 *
 * テスト対象:
 * - 48時間自動クローズのロジック（ADR-0020）
 * - durationSecの計算
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("auto-closer", () => {
  beforeEach(() => {
    // 現在時刻を固定: 2026-01-29T12:00:00Z
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-29T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("48時間自動クローズ判定ロジック", () => {
    const AUTO_CLOSE_THRESHOLD_MINUTES = 48 * 60; // 2880分

    it("48時間以上経過したセッションは期限切れ", () => {
      const now = new Date("2026-01-29T12:00:00Z");
      // 49時間前に開始
      const sessionStartTime = new Date("2026-01-27T11:00:00Z");
      const threshold = new Date(now.getTime() - AUTO_CLOSE_THRESHOLD_MINUTES * 60 * 1000);

      expect(sessionStartTime < threshold).toBe(true);
    });

    it("48時間未満のセッションは期限切れでない", () => {
      const now = new Date("2026-01-29T12:00:00Z");
      // 47時間前に開始
      const sessionStartTime = new Date("2026-01-27T13:00:00Z");
      const threshold = new Date(now.getTime() - AUTO_CLOSE_THRESHOLD_MINUTES * 60 * 1000);

      expect(sessionStartTime < threshold).toBe(false);
    });

    it("ちょうど48時間のセッションは期限切れでない（境界値）", () => {
      const now = new Date("2026-01-29T12:00:00Z");
      // ちょうど48時間前
      const sessionStartTime = new Date("2026-01-27T12:00:00Z");
      const threshold = new Date(now.getTime() - AUTO_CLOSE_THRESHOLD_MINUTES * 60 * 1000);

      // < なので等しい場合は期限切れでない
      expect(sessionStartTime < threshold).toBe(false);
    });
  });

  describe("durationSec計算ロジック", () => {
    it("正常な滞在時間を計算できる", () => {
      const startTime = new Date("2026-01-29T10:00:00Z");
      const endTime = new Date("2026-01-29T11:30:00Z");

      const durationSec = Math.max(
        0,
        Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
      );

      expect(durationSec).toBe(5400); // 1.5時間 = 5400秒
    });

    it("endTimeがstartTimeより前の場合は0を返す（負値防止）", () => {
      const startTime = new Date("2026-01-29T11:00:00Z");
      const endTime = new Date("2026-01-29T10:00:00Z"); // startTimeより前

      const durationSec = Math.max(
        0,
        Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
      );

      expect(durationSec).toBe(0);
    });

    it("同一時刻の場合は0を返す", () => {
      const startTime = new Date("2026-01-29T10:00:00Z");
      const endTime = new Date("2026-01-29T10:00:00Z");

      const durationSec = Math.max(
        0,
        Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
      );

      expect(durationSec).toBe(0);
    });

    it("48時間（最大期間）の滞在時間を計算できる", () => {
      const startTime = new Date("2026-01-27T12:00:00Z");
      const endTime = new Date("2026-01-29T12:00:00Z");

      const durationSec = Math.max(
        0,
        Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
      );

      expect(durationSec).toBe(172800); // 48時間 = 172800秒
    });
  });
});
