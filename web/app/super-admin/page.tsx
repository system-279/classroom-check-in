"use client";

import Link from "next/link";

/**
 * スーパー管理者ダッシュボード
 */
export default function SuperAdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">スーパー管理者ダッシュボード</h1>
        <p className="text-muted-foreground mt-2">
          システム全体の管理を行います
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/super-admin/tenants"
          className="block rounded-lg border bg-card p-6 hover:bg-accent transition-colors"
        >
          <h2 className="text-lg font-semibold mb-2">テナント管理</h2>
          <p className="text-sm text-muted-foreground">
            全テナントの一覧表示、ステータス変更（停止/再開）を行います
          </p>
        </Link>
      </div>
    </div>
  );
}
