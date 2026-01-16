"use client";

import Link from "next/link";
import { useTenant } from "@/lib/tenant-context";

/**
 * テナント対応管理者ダッシュボード
 */
export default function TenantAdminPage() {
  const { tenantId, isDemo } = useTenant();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          管理画面{isDemo ? "デモ" : ""}
        </h1>
        {isDemo && (
          <p className="mt-2 text-muted-foreground">
            管理者向けの各種機能を確認できます。
          </p>
        )}
      </div>

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
