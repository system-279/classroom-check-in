/**
 * バリデーション関連のユーティリティ
 */

/**
 * メールアドレスの正規表現
 * - 基本的な形式チェック（local@domain.tld）
 * - ローカル部: 英数字と一部記号（._%+-）
 * - ドメイン部: 英数字とハイフン、2文字以上のTLD
 * 注: 完全なRFC 5322準拠ではないが、一般的なメールアドレスを検証可能
 */
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/**
 * 有効なタイムゾーンのSet（遅延初期化）
 * Intl.supportedValuesOf("timeZone")がない環境でもエラーにならないよう遅延初期化
 */
let _validTimezones: Set<string> | null = null;

function getValidTimezones(): Set<string> {
  if (_validTimezones === null) {
    try {
      _validTimezones = new Set(Intl.supportedValuesOf("timeZone"));
    } catch {
      // フォールバック: 主要なタイムゾーンのみ
      _validTimezones = new Set([
        "UTC",
        "Asia/Tokyo",
        "America/New_York",
        "America/Los_Angeles",
        "Europe/London",
        "Europe/Paris",
      ]);
    }
  }
  return _validTimezones;
}

export const VALID_ROLES = ["admin", "teacher", "student"] as const;

export type UserRole = (typeof VALID_ROLES)[number];

/**
 * メールアドレスの形式を検証
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  // 長すぎるメールアドレスを拒否（RFC 5321: 最大254文字）
  if (email.length > 254) return false;
  return EMAIL_REGEX.test(email);
}

/**
 * タイムゾーンの有効性を検証
 */
export function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  return getValidTimezones().has(tz);
}

/**
 * ユーザーロールの有効性を検証（型ガード）
 */
export function isValidRole(role: string): role is UserRole {
  return VALID_ROLES.includes(role as UserRole);
}
