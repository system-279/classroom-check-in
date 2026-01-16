"use client";

import Link from "next/link";
import { useTenant } from "@/lib/tenant-context";

/**
 * テナント対応管理者レイアウト
 * サブナビゲーションを提供
 */
export default function TenantAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { tenantId } = useTenant();

  return (
    <div className="space-y-4">
      {/* サブナビゲーション */}
      <nav className="flex gap-4 text-sm border-b pb-2">
        <Link
          href={`/${tenantId}/admin/courses`}
          className="text-muted-foreground hover:text-foreground"
        >
          講座管理
        </Link>
        <Link
          href={`/${tenantId}/admin/users`}
          className="text-muted-foreground hover:text-foreground"
        >
          受講者管理
        </Link>
        <Link
          href={`/${tenantId}/admin/sessions`}
          className="text-muted-foreground hover:text-foreground"
        >
          セッション
        </Link>
        <Link
          href={`/${tenantId}/admin/notification-policies`}
          className="text-muted-foreground hover:text-foreground"
        >
          通知ポリシー
        </Link>
        <Link
          href={`/${tenantId}/admin/allowed-emails`}
          className="text-muted-foreground hover:text-foreground"
        >
          アクセス許可
        </Link>
      </nav>
      {children}
    </div>
  );
}
