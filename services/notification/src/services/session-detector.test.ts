/**
 * session-detector.ts のユニットテスト
 *
 * テスト対象:
 * - isSessionStale: セッションがstale（通知対象）かどうかの判定
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isSessionStale, type TenantSession } from "./session-detector.js";

describe("session-detector", () => {
  beforeEach(() => {
    // 現在時刻を固定: 2026-01-29T12:00:00Z
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-29T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isSessionStale", () => {
    const createSession = (lastHeartbeatAt: Date): TenantSession => ({
      id: "session-1",
      tenantId: "tenant-1",
      courseId: "course-1",
      userId: "user-1",
      startTime: new Date("2026-01-29T10:00:00Z"),
      endTime: null,
      lastHeartbeatAt,
      status: "open",
    });

    it("閾値を超えたセッションはstale", () => {
      // 現在12:00、lastHeartbeat 10:00 → 120分経過
      // 閾値60分 → stale
      const session = createSession(new Date("2026-01-29T10:00:00Z"));
      expect(isSessionStale(session, 60)).toBe(true);
    });

    it("閾値以内のセッションはstaleでない", () => {
      // 現在12:00、lastHeartbeat 11:30 → 30分経過
      // 閾値60分 → not stale
      const session = createSession(new Date("2026-01-29T11:30:00Z"));
      expect(isSessionStale(session, 60)).toBe(false);
    });

    it("閾値ちょうどのセッションはstaleでない", () => {
      // 現在12:00、lastHeartbeat 11:00 → 60分経過
      // 閾値60分 → not stale（境界値、<なので等しい場合はfalse）
      const session = createSession(new Date("2026-01-29T11:00:00Z"));
      expect(isSessionStale(session, 60)).toBe(false);
    });

    it("閾値を1分超えたセッションはstale", () => {
      // 現在12:00、lastHeartbeat 10:59 → 61分経過
      // 閾値60分 → stale
      const session = createSession(new Date("2026-01-29T10:59:00Z"));
      expect(isSessionStale(session, 60)).toBe(true);
    });

    it("異なる閾値で正しく判定できる", () => {
      // 現在12:00、lastHeartbeat 10:00 → 120分経過
      const session = createSession(new Date("2026-01-29T10:00:00Z"));

      // 閾値90分 → stale
      expect(isSessionStale(session, 90)).toBe(true);

      // 閾値150分 → not stale
      expect(isSessionStale(session, 150)).toBe(false);
    });
  });
});
