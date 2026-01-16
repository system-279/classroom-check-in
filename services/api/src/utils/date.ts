/**
 * 日付関連のユーティリティ関数
 */

/**
 * DateをISO文字列に変換（null安全、無効なDate安全）
 * @param date - 変換対象のDateオブジェクト（nullの場合はnullを返す）
 * @returns ISO 8601形式の文字列、またはnull（無効なDateの場合も含む）
 */
export function toISOString(date: Date | null): string | null {
  if (!date) return null;
  // 無効なDateインスタンス（例: new Date("invalid")）をガード
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}
