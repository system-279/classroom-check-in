import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <section className="rounded-lg border bg-card p-8 text-center max-w-md">
        <h1 className="text-2xl font-bold mb-4">Classroom Check-in</h1>
        <p className="text-muted-foreground mb-6">
          講座を選択して入室するためのアプリです。
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/student/courses"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            受講者として入室
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            管理画面
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          開発モード（認証なし）
        </p>
      </section>
    </main>
  );
}
