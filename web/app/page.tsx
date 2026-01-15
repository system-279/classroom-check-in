"use client";

import Link from "next/link";
import { useAuth } from "../lib/auth-context";

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev";

export default function HomePage() {
  const { user, loading, error, signInWithGoogle, signOut } = useAuth();

  // Firebase認証モードで未ログインの場合はログイン画面を表示
  if (AUTH_MODE === "firebase" && !user && !loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <section className="rounded-lg border bg-card p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Classroom Check-in</h1>
          <p className="text-muted-foreground mb-6">
            講座を選択して入室するためのアプリです。
          </p>
          {error && (
            <p className="text-sm text-red-500 mb-4">{error}</p>
          )}
          <button
            onClick={signInWithGoogle}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors w-full"
          >
            Googleでログイン
          </button>
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              ログインせずに試してみる
            </p>
            <Link
              href="/demo/admin"
              className="text-sm text-primary hover:underline"
            >
              デモを見る →
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // ローディング中
  if (AUTH_MODE === "firebase" && loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <section className="rounded-lg border bg-card p-8 text-center max-w-md">
          <p className="text-muted-foreground">読み込み中...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <section className="rounded-lg border bg-card p-8 text-center max-w-md">
        <h1 className="text-2xl font-bold mb-4">Classroom Check-in</h1>
        <p className="text-muted-foreground mb-6">
          講座を選択して入室するためのアプリです。
        </p>

        {AUTH_MODE === "firebase" && user && (
          <p className="text-sm text-muted-foreground mb-4">
            ログイン中: {user.email}
          </p>
        )}

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
          {AUTH_MODE === "firebase" && user && (
            <button
              onClick={signOut}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              ログアウト
            </button>
          )}
        </div>

        {AUTH_MODE === "dev" && (
          <p className="mt-4 text-xs text-muted-foreground">
            開発モード（認証なし）
          </p>
        )}

        <div className="mt-4 pt-4 border-t">
          <Link
            href="/demo/admin"
            className="text-sm text-muted-foreground hover:text-primary hover:underline"
          >
            デモを見る →
          </Link>
        </div>
      </section>
    </main>
  );
}
