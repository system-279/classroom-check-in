import { describe, it, expect } from "vitest";
import {
  isValidEmail,
  isValidTimezone,
  isValidRole,
  EMAIL_REGEX,
  VALID_ROLES,
} from "./validation.js";

describe("validation", () => {
  describe("isValidEmail", () => {
    it("有効なメールアドレスを受け入れる", () => {
      expect(isValidEmail("test@example.com")).toBe(true);
      expect(isValidEmail("user.name@example.com")).toBe(true);
      expect(isValidEmail("user+tag@example.com")).toBe(true);
      expect(isValidEmail("user@sub.domain.com")).toBe(true);
    });

    it("無効なメールアドレスを拒否する", () => {
      expect(isValidEmail("invalid")).toBe(false);
      expect(isValidEmail("@example.com")).toBe(false);
      expect(isValidEmail("test@")).toBe(false);
      expect(isValidEmail("test@.com")).toBe(false);
      expect(isValidEmail("test@domain")).toBe(false);
    });

    it("空文字列を拒否する", () => {
      expect(isValidEmail("")).toBe(false);
    });

    it("nullやundefinedを拒否する", () => {
      expect(isValidEmail(null as unknown as string)).toBe(false);
      expect(isValidEmail(undefined as unknown as string)).toBe(false);
    });

    it("非文字列を拒否する", () => {
      expect(isValidEmail(123 as unknown as string)).toBe(false);
      expect(isValidEmail({} as unknown as string)).toBe(false);
    });

    it("254文字を超えるメールアドレスを拒否する", () => {
      // example.com = 11文字, @ = 1文字, ローカル部 = 242文字 → 合計254文字
      const longLocal = "a".repeat(242);
      expect(isValidEmail(`${longLocal}@example.com`)).toBe(true);

      // 255文字のメールアドレス
      const tooLongLocal = "a".repeat(243);
      expect(isValidEmail(`${tooLongLocal}@example.com`)).toBe(false);
    });

    it("ドメイン部のエッジケースを検証する", () => {
      // ハイフンで始まるドメインは無効
      expect(isValidEmail("test@-example.com")).toBe(false);
      // 連続したドットは無効
      expect(isValidEmail("test@example..com")).toBe(false);
      // 数字のみのドメインは有効
      expect(isValidEmail("test@123.456.com")).toBe(true);
    });
  });

  describe("isValidTimezone", () => {
    it("有効なタイムゾーンを受け入れる", () => {
      // Node.js環境で確実にサポートされるタイムゾーン
      expect(isValidTimezone("Asia/Tokyo")).toBe(true);
      expect(isValidTimezone("America/New_York")).toBe(true);
      expect(isValidTimezone("Europe/London")).toBe(true);
    });

    it("無効なタイムゾーンを拒否する", () => {
      expect(isValidTimezone("Invalid/Timezone")).toBe(false);
      expect(isValidTimezone("Tokyo")).toBe(false);
      expect(isValidTimezone("JST")).toBe(false);
    });

    it("空文字列を拒否する", () => {
      expect(isValidTimezone("")).toBe(false);
    });

    it("nullやundefinedを拒否する", () => {
      expect(isValidTimezone(null as unknown as string)).toBe(false);
      expect(isValidTimezone(undefined as unknown as string)).toBe(false);
    });

    it("非文字列を拒否する", () => {
      expect(isValidTimezone(123 as unknown as string)).toBe(false);
    });
  });

  describe("isValidRole", () => {
    it("有効なロールを受け入れる", () => {
      expect(isValidRole("admin")).toBe(true);
      expect(isValidRole("teacher")).toBe(true);
      expect(isValidRole("student")).toBe(true);
    });

    it("無効なロールを拒否する", () => {
      expect(isValidRole("invalid")).toBe(false);
      expect(isValidRole("superadmin")).toBe(false);
      expect(isValidRole("ADMIN")).toBe(false); // 大文字は無効
    });

    it("空文字列を拒否する", () => {
      expect(isValidRole("")).toBe(false);
    });
  });

  describe("EMAIL_REGEX", () => {
    it("正規表現がエクスポートされている", () => {
      expect(EMAIL_REGEX).toBeInstanceOf(RegExp);
    });
  });

  describe("VALID_ROLES", () => {
    it("定数がエクスポートされている", () => {
      expect(VALID_ROLES).toEqual(["admin", "teacher", "student"]);
    });
  });
});
