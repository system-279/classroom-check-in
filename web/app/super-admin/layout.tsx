"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";

/**
 * スーパー管理者レイアウト
 * SUPER_ADMIN_EMAILSに含まれるユーザーのみアクセス可能
 */
export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/");
      return;
    }

    // スーパー管理者APIを呼び出して認可チェック
    const checkSuperAdmin = async () => {
      try {
        const idToken = await getIdToken();
        if (!idToken) {
          setError("認証トークンを取得できませんでした");
          setChecking(false);
          return;
        }

        // テナント一覧取得でスーパー管理者権限をチェック
        await apiFetch("/api/v2/super/tenants?limit=1", { idToken });
        setAuthorized(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : "エラーが発生しました";
        if (message.includes("403") || message.includes("forbidden") || message.includes("スーパー管理者")) {
          setError("スーパー管理者権限が必要です");
        } else if (message.includes("401") || message.includes("unauthorized")) {
          setError("認証に失敗しました。再ログインしてください。");
        } else {
          setError(message);
        }
      } finally {
        setChecking(false);
      }
    };

    checkSuperAdmin();
  }, [authLoading, user, getIdToken, router]);

  // ローディング中
  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">認証を確認中...</div>
      </div>
    );
  }

  // エラー（権限なし）
  if (error || !authorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">アクセス拒否</h1>
          <p className="text-muted-foreground mb-6">{error || "このページへのアクセス権限がありません"}</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: "/super-admin", label: "ダッシュボード" },
    { href: "/super-admin/tenants", label: "テナント管理" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* スーパー管理者バナー */}
      <div className="bg-red-100 border-b border-red-300 text-red-800 text-center py-2 text-sm">
        スーパー管理者モード - 全テナントへのアクセス権限があります
      </div>
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link href="/super-admin" className="font-semibold text-red-600">
            System Admin
          </Link>
          <nav className="flex gap-4 text-sm">
            <span className="text-muted-foreground">|</span>
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== "/super-admin" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`font-medium ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto text-sm text-muted-foreground">
            {user?.email}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">{children}</main>
    </div>
  );
}
