import Link from "next/link";

export default function DemoAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">管理画面デモ</h1>
        <p className="mt-2 text-muted-foreground">
          管理者向けの各種機能を確認できます。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/demo/admin/courses"
          className="rounded-lg border p-4 hover:bg-accent"
        >
          <h2 className="font-semibold">講座管理</h2>
          <p className="text-sm text-muted-foreground">
            講座の追加・編集・削除
          </p>
        </Link>
        <Link
          href="/demo/admin/users"
          className="rounded-lg border p-4 hover:bg-accent"
        >
          <h2 className="font-semibold">受講者管理</h2>
          <p className="text-sm text-muted-foreground">
            ユーザー登録・受講講座の割当
          </p>
        </Link>
        <Link
          href="/demo/admin/sessions"
          className="rounded-lg border p-4 hover:bg-accent"
        >
          <h2 className="font-semibold">セッション管理</h2>
          <p className="text-sm text-muted-foreground">
            入退室記録の確認・補正
          </p>
        </Link>
        <Link
          href="/demo/admin/notification-policies"
          className="rounded-lg border p-4 hover:bg-accent"
        >
          <h2 className="font-semibold">通知ポリシー</h2>
          <p className="text-sm text-muted-foreground">
            OUT忘れ通知の設定
          </p>
        </Link>
        <Link
          href="/demo/admin/allowed-emails"
          className="rounded-lg border p-4 hover:bg-accent"
        >
          <h2 className="font-semibold">アクセス許可</h2>
          <p className="text-sm text-muted-foreground">
            ログイン可能なメールアドレスの管理
          </p>
        </Link>
      </div>
    </div>
  );
}
