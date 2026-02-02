import Link from "next/link";

export default function DemoAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {/* サブナビゲーション */}
      <nav className="flex gap-4 text-sm border-b pb-2">
        <Link
          href="/demo/admin/courses"
          className="text-muted-foreground hover:text-foreground"
        >
          講座管理
        </Link>
        <Link
          href="/demo/admin/users"
          className="text-muted-foreground hover:text-foreground"
        >
          受講者管理
        </Link>
        <Link
          href="/demo/admin/sessions"
          className="text-muted-foreground hover:text-foreground"
        >
          セッション
        </Link>
        <Link
          href="/demo/admin/notification-policies"
          className="text-muted-foreground hover:text-foreground"
        >
          通知ポリシー
        </Link>
        <Link
          href="/demo/admin/allowed-emails"
          className="text-muted-foreground hover:text-foreground"
        >
          アクセス許可
        </Link>
        <Link
          href="/demo/admin/auth-errors"
          className="text-muted-foreground hover:text-foreground"
        >
          認証エラー
        </Link>
      </nav>
      {children}
    </div>
  );
}
