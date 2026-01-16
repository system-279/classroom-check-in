/**
 * 日付関連のユーティリティ関数
 */

/**
 * DateをISO文字列に変換（null安全）
 */
export function toISOString(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}
