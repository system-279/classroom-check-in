"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuthFetch } from "@/lib/auth-fetch-context";
import { useAuth } from "@/lib/auth-context";
import type { AllowedEmail } from "@/types/allowed-email";
import { AllowedEmailTable } from "./_components/allowed-email-table";
import { AddEmailDialog } from "./_components/add-email-dialog";

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev";

export default function AllowedEmailsPage() {
  const router = useRouter();
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
      router.push("/");
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
            ログインを許可するメールアドレスを管理します。既存ユーザーは引き続きアクセス可能です。
          </p>
        </div>
        <Button onClick={handleCreate}>追加</Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground">読み込み中...</div>
      ) : (
        <AllowedEmailTable
          allowedEmails={allowedEmails}
          onDelete={fetchAllowedEmails}
        />
      )}

      <AddEmailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
