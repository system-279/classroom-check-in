/**
 * バリデーション関連のユーティリティ
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const VALID_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));
export const VALID_ROLES = ["admin", "teacher", "student"] as const;

export type UserRole = (typeof VALID_ROLES)[number];

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function isValidTimezone(tz: string): boolean {
  return VALID_TIMEZONES.has(tz);
}

export function isValidRole(role: string): role is UserRole {
  return VALID_ROLES.includes(role as UserRole);
}
