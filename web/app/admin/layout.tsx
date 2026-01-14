import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link href="/admin" className="font-semibold">
            Classroom Check-in
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link
              href="/admin/courses"
              className="text-muted-foreground hover:text-foreground"
            >
              講座管理
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">{children}</main>
    </div>
  );
}
