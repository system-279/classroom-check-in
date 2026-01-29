import { describe, it, expect } from "vitest";
import { toISOString } from "./date.js";

describe("date", () => {
  describe("toISOString", () => {
    it("有効なDateをISO文字列に変換する", () => {
      const date = new Date("2026-01-29T10:00:00.000Z");
      expect(toISOString(date)).toBe("2026-01-29T10:00:00.000Z");
    });

    it("nullを返す（入力がnullの場合）", () => {
      expect(toISOString(null)).toBeNull();
    });

    it("無効なDateに対してnullを返す", () => {
      const invalidDate = new Date("invalid");
      expect(toISOString(invalidDate)).toBeNull();
    });

    it("エポック時刻（1970-01-01）を正しく変換する", () => {
      const epoch = new Date(0);
      expect(toISOString(epoch)).toBe("1970-01-01T00:00:00.000Z");
    });

    it("未来の日付を正しく変換する", () => {
      const future = new Date("2099-12-31T23:59:59.999Z");
      expect(toISOString(future)).toBe("2099-12-31T23:59:59.999Z");
    });

    it("ミリ秒精度を保持する", () => {
      const date = new Date("2026-01-29T10:00:00.123Z");
      expect(toISOString(date)).toBe("2026-01-29T10:00:00.123Z");
    });
  });
});
