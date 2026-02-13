"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuthFetch } from "@/lib/auth-fetch-context";
import { useAuth } from "@/lib/auth-context";
import { useTenantOptional } from "@/lib/tenant-context";
import type { AllowedEmail } from "@/types/allowed-email";
import { AllowedEmailTable } from "./_components/allowed-email-table";
import { AddEmailDialog } from "./_components/add-email-dialog";

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev";

export default function AllowedEmailsPage() {
  const router = useRouter();
  const tenant = useTenantOptional();
  const authFetch = useAuthFetch();
  const { user, loading: authLoading } = useAuth();
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchAllowedEmails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authFetch<{ allowedEmails: AllowedEmail[] }>(
        "/api/v1/admin/allowed-emails"
      );
      setAllowedEmails(data.allowedEmails);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch allowed emails");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    // Firebase認証モードで未認証の場合はホームへリダイレクト
    if (AUTH_MODE === "firebase" && !authLoading && !user) {
      router.push(tenant ? `/${tenant.tenantId}` : "/");
      return;
    }
    if (AUTH_MODE === "firebase" && authLoading) {
      return;
    }
    fetchAllowedEmails();
  }, [authLoading, user, router, fetchAllowedEmails]);

  const handleCreate = () => {
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    setDialogOpen(false);
    fetchAllowedEmails();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">アクセス許可</h1>
          <p className="text-sm text-muted-foreground mt-1">
            この管理画面にログインできるアカウントを管理します。
            <br />
            ここに登録されたメールアドレスのみが新規ログイン可能です。
          </p>
        </div>
        <Button onClick={handleCreate}>追加</Button>
      </div>

      {/* 管理者アカウント */}
      <div className="rounded-md border bg-muted/50 p-4">
        <h2 className="text-sm font-medium mb-2">管理者アカウント（固定）</h2>
        <p className="text-sm text-muted-foreground">
          <code className="bg-background px-1.5 py-0.5 rounded">system@279279.net</code>
          {" "}— システム管理者（常にアクセス可能）
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium mb-2">許可されたアカウント</h2>
        {loading ? (
          <div className="text-muted-foreground">読み込み中...</div>
        ) : (
          <AllowedEmailTable
            allowedEmails={allowedEmails}
            onDelete={fetchAllowedEmails}
          />
        )}
      </div>

      <AddEmailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
