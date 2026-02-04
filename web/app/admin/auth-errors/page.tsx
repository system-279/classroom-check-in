"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthFetch } from "@/lib/auth-fetch-context";
import { useAuth } from "@/lib/auth-context";
import type { AuthErrorLog } from "@/types/auth-error-log";

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev";

export default function AuthErrorsPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const { user, loading: authLoading } = useAuth();
  const [authErrors, setAuthErrors] = useState<AuthErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // フィルタ状態
  const [emailFilter, setEmailFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  const fetchAuthErrors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (emailFilter) params.set("email", emailFilter);
      if (startDateFilter) params.set("startDate", new Date(startDateFilter).toISOString());
      if (endDateFilter) params.set("endDate", new Date(endDateFilter).toISOString());
      params.set("limit", "100");

      const queryString = params.toString();
      const url = `/api/v1/admin/auth-errors${queryString ? `?${queryString}` : ""}`;

      const data = await authFetch<{ authErrorLogs: AuthErrorLog[] }>(url);
      setAuthErrors(data.authErrorLogs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch auth error logs");
    } finally {
      setLoading(false);
    }
  }, [authFetch, emailFilter, startDateFilter, endDateFilter]);

  useEffect(() => {
    // Firebase認証モードで未認証の場合はホームへリダイレクト
    if (AUTH_MODE === "firebase" && !authLoading && !user) {
      router.push("/");
      return;
    }
    if (AUTH_MODE === "firebase" && authLoading) {
      return;
    }
    fetchAuthErrors();
  }, [authLoading, user, router, fetchAuthErrors]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAuthErrors();
  };

  const handleClearFilters = () => {
    setEmailFilter("");
    setStartDateFilter("");
    setEndDateFilter("");
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">認証エラー履歴</h1>
        <p className="text-sm text-muted-foreground mt-1">
          許可されていないアカウントでのログイン試行履歴を確認できます。
        </p>
      </div>

      {/* フィルタ */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-1 block">メールアドレス</label>
          <Input
            type="email"
            placeholder="example@gmail.com"
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
          />
        </div>
        <div className="w-[180px]">
          <label className="text-sm font-medium mb-1 block">開始日</label>
          <Input
            type="date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
          />
        </div>
        <div className="w-[180px]">
          <label className="text-sm font-medium mb-1 block">終了日</label>
          <Input
            type="date"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit">検索</Button>
          <Button type="button" variant="outline" onClick={handleClearFilters}>
            クリア
          </Button>
        </div>
      </form>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* テーブル */}
      {loading ? (
        <div className="text-muted-foreground">読み込み中...</div>
      ) : authErrors.length === 0 ? (
        <div className="text-muted-foreground">認証エラーログはありません。</div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="py-3 px-4 text-left font-medium">発生日時</th>
                <th className="py-3 px-4 text-left font-medium">メールアドレス</th>
                <th className="py-3 px-4 text-left font-medium">エラー種別</th>
                <th className="py-3 px-4 text-left font-medium">パス</th>
                <th className="py-3 px-4 text-left font-medium">ユーザーエージェント</th>
              </tr>
            </thead>
            <tbody>
              {authErrors.map((log) => (
                <tr key={log.id} className="border-b last:border-0">
                  <td className="py-3 px-4 whitespace-nowrap">
                    {formatDate(log.occurredAt)}
                  </td>
                  <td className="py-3 px-4 break-all">{log.email}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                      {log.errorType}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    <code className="text-xs">{log.method} {log.path}</code>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground truncate max-w-[200px]" title={log.userAgent ?? undefined}>
                    {log.userAgent ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && authErrors.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {authErrors.length}件のエラーログを表示中
        </p>
      )}
    </div>
  );
}
