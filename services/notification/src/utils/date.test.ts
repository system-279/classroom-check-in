/**
 * date.ts のユニットテスト
 */

import { describe, it, expect } from "vitest";
import { toDate } from "./date.js";

describe("toDate", () => {
  it("Dateオブジェクトをそのまま返す", () => {
    const date = new Date("2026-01-29T10:00:00Z");
    expect(toDate(date)).toBe(date);
  });

  it("undefinedの場合はエポック日時を返す", () => {
    const result = toDate(undefined);
    expect(result.getTime()).toBe(0);
  });

  it("Timestampオブジェクトを変換する", () => {
    const mockTimestamp = {
      toDate: () => new Date("2026-01-29T10:00:00Z"),
    };
    // Timestampの型をモック
    const result = toDate(mockTimestamp as unknown as Parameters<typeof toDate>[0]);
    expect(result.toISOString()).toBe("2026-01-29T10:00:00.000Z");
  });
});
