import Link from "next/link";

export default function DemoPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Classroom Check-in デモ</h1>
        <p className="mt-2 text-muted-foreground">
          ログイン不要でシステムの機能を試すことができます。
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 管理者向けデモ */}
        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="text-xl font-semibold">管理者向け機能</h2>
          <p className="text-sm text-muted-foreground">
            講座・受講者・セッションの管理、通知ポリシーの設定などを確認できます。
          </p>
          <div className="space-y-2">
            <Link
              href="/demo/admin"
              className="block rounded-md bg-primary px-4 py-2 text-center text-primary-foreground hover:bg-primary/90"
            >
              管理画面を見る
            </Link>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>主な機能:</p>
              <ul className="list-disc list-inside pl-2">
                <li>講座管理（追加・編集・削除）</li>
                <li>受講者管理（登録・受講講座割当）</li>
                <li>セッション管理（入退室記録の確認・補正）</li>
                <li>通知ポリシー設定（OUT忘れ通知）</li>
                <li>アクセス許可リスト管理</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 受講者向けデモ */}
        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="text-xl font-semibold">受講者向け機能</h2>
          <p className="text-sm text-muted-foreground">
            講座への入室（IN）・退室（OUT）操作を体験できます。
          </p>
          <div className="space-y-2">
            <Link
              href="/demo/student"
              className="block rounded-md bg-secondary px-4 py-2 text-center text-secondary-foreground hover:bg-secondary/90"
            >
              受講者画面を見る
            </Link>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>主な機能:</p>
              <ul className="list-disc list-inside pl-2">
                <li>受講中の講座一覧</li>
                <li>入室（IN）ボタン</li>
                <li>退室（OUT）ボタン</li>
                <li>滞在時間の確認</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="font-medium text-blue-800">デモデータについて</h3>
        <p className="mt-1 text-sm text-blue-700">
          このデモでは以下のサンプルデータが登録されています:
        </p>
        <ul className="mt-2 text-sm text-blue-700 list-disc list-inside">
          <li>ユーザー: 管理者1名、講師1名、受講者3名</li>
          <li>講座: プログラミング基礎、Web開発入門、データサイエンス入門</li>
          <li>セッション: 継続中・終了・補正済のサンプル</li>
        </ul>
      </div>
    </div>
  );
}
