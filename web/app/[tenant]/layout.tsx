"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { TenantProvider, useTenant } from "@/lib/tenant-context";
import { useAuth } from "@/lib/auth-context";
import { useAuthFetch } from "@/lib/auth-fetch-context";

type UserRole = "admin" | "teacher" | "student" | null;

interface AuthMeResponse {
  user?: { role?: string };
  isSuperAdminAccess?: boolean;
}

/**
 * ナビゲーションコンポーネント
 * ユーザーロールに基づいてリンクを表示
 */
function TenantNav({ isSuperAdminAccess }: { isSuperAdminAccess: boolean }) {
  const { tenantId, isDemo } = useTenant();
  const { user, loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 認証中または未ログインの場合はスキップ
    if (authLoading) return;
    if (!user && !isDemo) {
      setLoading(false);
      return;
    }

    // ユーザー情報を取得してロールを設定
    const fetchUserRole = async () => {
      try {
        const data = await authFetch<AuthMeResponse>("/auth/me");
        setRole((data.user?.role as UserRole) ?? "student");
      } catch {
        // エラー時はstudent扱い
        setRole("student");
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [authFetch, user, authLoading, isDemo]);

  const isAdmin = role === "admin" || role === "teacher";

  return (
    <nav className="flex gap-4 text-sm">
      <span className="text-muted-foreground">|</span>
      {/* 管理者・教員のみ表示（スーパー管理者も含む） */}
      {!loading && isAdmin && (
        <Link
          href={`/${tenantId}/admin`}
          className="text-muted-foreground hover:text-foreground font-medium"
        >
          管理者向け
        </Link>
      )}
      {/* 受講者リンクは管理者には非表示 */}
      {!loading && !isAdmin && !isSuperAdminAccess && (
        <Link
          href={`/${tenantId}/student`}
          className="text-muted-foreground hover:text-foreground font-medium"
        >
          受講者向け
        </Link>
      )}
    </nav>
  );
}

/**
 * テナントレイアウトの内部コンポーネント
 * TenantProvider配下でuseTenantを使用
 */
function TenantLayoutInner({ children }: { children: React.ReactNode }) {
  const { tenantId, isDemo } = useTenant();
  const { user, loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  const [isSuperAdminAccess, setIsSuperAdminAccess] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;

    const checkSuperAdminAccess = async () => {
      try {
        const data = await authFetch<AuthMeResponse>("/auth/me");
        setIsSuperAdminAccess(data.isSuperAdminAccess ?? false);
      } catch {
        setIsSuperAdminAccess(false);
      }
    };

    checkSuperAdminAccess();
  }, [authFetch, user, authLoading]);

  return (
    <div className="min-h-screen bg-background">
      {/* スーパー管理者アクセスバナー */}
      {isSuperAdminAccess && (
        <div className="bg-red-100 border-b border-red-300 text-red-800 text-center py-2 text-sm">
          スーパー管理者としてアクセス中 -{" "}
          <Link href="/super-admin" className="underline font-medium">
            スーパー管理画面に戻る
          </Link>
        </div>
      )}
      {/* デモモードバナー */}
      {isDemo && (
        <div className="bg-yellow-100 border-b border-yellow-300 text-yellow-800 text-center py-2 text-sm">
          デモモード（読み取り専用） - データの閲覧のみ可能です
        </div>
      )}
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link
            href={`/${tenantId}`}
            className={`font-semibold ${isDemo ? "text-blue-600" : ""}`}
          >
            Classroom Check-in{isDemo ? " (DEMO)" : ""}
          </Link>
          <TenantNav isSuperAdminAccess={isSuperAdminAccess} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">{children}</main>
    </div>
  );
}

/**
 * テナント対応レイアウト
 * URLパスからテナントIDを抽出し、TenantProviderで子コンポーネントをラップ
 */
export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const tenantId = (params?.tenant as string) ?? "demo";

  return (
    <TenantProvider tenantId={tenantId}>
      <TenantLayoutInner>{children}</TenantLayoutInner>
    </TenantProvider>
  );
}
