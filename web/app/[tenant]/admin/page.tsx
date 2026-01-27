"use client";

import { useState } from "react";
import Link from "next/link";
import { useTenant } from "@/lib/tenant-context";
import { Button } from "@/components/ui/button";

/**
 * コピーボタンコンポーネント
 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="shrink-0"
    >
      {copied ? "コピーしました" : "コピー"}
    </Button>
  );
}

/**
 * テナント対応管理者ダッシュボード
 */
export default function TenantAdminPage() {
  const { tenantId, isDemo } = useTenant();

  // フルURLを生成（クライアントサイドでのみ実行）
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const studentUrl = `${baseUrl}/${tenantId}/student`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          管理画面{isDemo ? " (デモ)" : ""}
        </h1>
        {isDemo && (
          <p className="mt-2 text-muted-foreground">
            管理者向けの各種機能を確認できます。
          </p>
        )}
      </div>

      {/* 受講者向けリンク共有セクション */}
      <div className="rounded-lg border bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-semibold text-blue-900">受講者向けリンク</h2>
            <p className="text-sm text-blue-700">
              このリンクを受講者に共有してください
            </p>
          </div>
          <svg
            className="h-8 w-8 text-blue-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 rounded bg-white/80 border border-blue-200 px-3 py-2 text-sm font-mono truncate">
            {studentUrl}
          </code>
          <CopyButton text={studentUrl} />
        </div>
      </div>

      {/* メニューグリッド */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href={`/${tenantId}/admin/courses`}
          className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors"
        >
          <h2 className="font-semibold">講座管理</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            講座の追加・編集・削除
          </p>
        </Link>
        <Link
          href={`/${tenantId}/admin/users`}
          className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors"
        >
          <h2 className="font-semibold">受講者管理</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ユーザーの追加・編集・講座登録
          </p>
        </Link>
        <Link
          href={`/${tenantId}/admin/sessions`}
          className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors"
        >
          <h2 className="font-semibold">セッション管理</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            入退室記録の確認・補正
          </p>
        </Link>
        <Link
          href={`/${tenantId}/admin/notification-policies`}
          className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors"
        >
          <h2 className="font-semibold">通知ポリシー</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            OUT忘れ通知の設定
          </p>
        </Link>
        <Link
          href={`/${tenantId}/admin/allowed-emails`}
          className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors"
        >
          <h2 className="font-semibold">アクセス許可</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ログイン許可メールの管理
          </p>
        </Link>
      </div>
    </div>
  );
}
