import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">管理画面</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/courses">
          <div className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors">
            <h2 className="font-semibold">講座管理</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              講座の追加・編集・削除
            </p>
          </div>
        </Link>
        <Link href="/admin/users">
          <div className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors">
            <h2 className="font-semibold">受講者管理</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              ユーザーの追加・編集・講座登録
            </p>
          </div>
        </Link>
        <Link href="/admin/sessions">
          <div className="rounded-lg border bg-card p-6 hover:bg-accent transition-colors">
            <h2 className="font-semibold">セッション管理</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              入退室記録の確認・補正
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
