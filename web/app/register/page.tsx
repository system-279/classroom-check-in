"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CreateTenantResponse } from "@/types/tenant";

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading: authLoading, signInWithGoogle, getIdToken } = useAuth();
  const [organizationName, setOrganizationName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!organizationName.trim()) {
      setError("組織名を入力してください。");
      return;
    }

    if (organizationName.length > 100) {
      setError("組織名は100文字以内で入力してください。");
      return;
    }

    setIsSubmitting(true);

    try {
      const idToken = await getIdToken();
      if (!idToken) {
        setError("認証トークンを取得できませんでした。再ログインしてください。");
        setIsSubmitting(false);
        return;
      }

      const response = await apiFetch<CreateTenantResponse>("/api/v2/tenants", {
        method: "POST",
        body: JSON.stringify({ name: organizationName.trim() }),
        idToken,
      });

      // 作成成功 → テナント管理画面へ
      router.push(response.adminUrl);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "テナントの作成に失敗しました。再度お試しください。"
      );
      setIsSubmitting(false);
    }
  };

  // ローディング中
  if (authLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">読み込み中...</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  // 未ログイン → ログインを促す
  if (!user) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle>新規登録</CardTitle>
            <CardDescription>
              組織を登録するにはGoogleアカウントでログインしてください。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={signInWithGoogle} className="w-full">
              Googleでログイン
            </Button>
            <div className="text-center">
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-primary"
              >
                ← ホームに戻る
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  // ログイン済み → 登録フォーム
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardHeader>
          <CardTitle>組織を登録</CardTitle>
          <CardDescription>
            Classroom Check-inを利用する組織を登録します。
            <br />
            登録後、すぐに利用を開始できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">ログイン中のアカウント</Label>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground">
                このアカウントが組織の管理者になります。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizationName">組織名 *</Label>
              <Input
                id="organizationName"
                type="text"
                placeholder="例: ○○学習塾"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                maxLength={100}
                disabled={isSubmitting}
                required
              />
              <p className="text-xs text-muted-foreground">
                学校、塾、教室などの名前を入力してください（1〜100文字）
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "作成中..." : "組織を作成"}
            </Button>

            <div className="text-center pt-2">
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-primary"
              >
                ← ホームに戻る
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
