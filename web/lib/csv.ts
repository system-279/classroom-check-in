/**
 * CSVダウンロードユーティリティ
 */

type CsvRow = Record<string, string | number | null | undefined>;

/**
 * オブジェクト配列をCSV文字列に変換
 */
export function toCsv<T extends CsvRow>(
  data: T[],
  columns: { key: keyof T; label: string }[]
): string {
  const header = columns.map((col) => escapeCsvField(col.label)).join(",");
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = row[col.key];
        if (value === null || value === undefined) return "";
        return escapeCsvField(String(value));
      })
      .join(",")
  );
  return [header, ...rows].join("\n");
}

/**
 * CSVフィールドをエスケープ（カンマ、改行、ダブルクォートを含む場合）
 */
function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * CSV文字列をBlobとしてダウンロード
 */
export function downloadCsv(csv: string, filename: string): void {
  // BOMを付けてExcelで文字化けしないようにする
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const blob = new Blob([bom, csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
