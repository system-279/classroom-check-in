"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SuperAdmin {
  email: string;
  source: "env" | "firestore";
  addedAt?: string;
  addedBy?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function SuperAdminManagementPage() {
  const { getIdToken, user } = useAuth();
  const [admins, setAdmins] = useState<SuperAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);

  // 削除確認ダイアログ
  const [deleteTarget, setDeleteTarget] = useState<SuperAdmin | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getIdToken();
      const res = await fetch(`${API_URL}/api/v2/super/admins`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch admins");
      }

      const data = await res.json();
      setAdmins(data.admins);
      setError(null);
    } catch (e) {
      console.error("Error fetching admins:", e);
      setError("スーパー管理者一覧の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleAdd = async () => {
    if (!newEmail.trim()) return;

    try {
      setAdding(true);
      const token = await getIdToken();
      const res = await fetch(`${API_URL}/api/v2/super/admins`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: newEmail.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to add admin");
      }

      setNewEmail("");
      await fetchAdmins();
    } catch (e) {
      console.error("Error adding admin:", e);
      setError(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      const token = await getIdToken();
      const res = await fetch(
        `${API_URL}/api/v2/super/admins/${encodeURIComponent(deleteTarget.email)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete admin");
      }

      setDeleteTarget(null);
      await fetchAdmins();
    } catch (e) {
      console.error("Error deleting admin:", e);
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("ja-JP");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">スーパー管理者管理</h1>
        <p className="text-muted-foreground mt-2">
          システム全体を管理できる管理者アカウントを管理します
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          {error}
          <button
            className="ml-4 underline"
            onClick={() => setError(null)}
          >
            閉じる
          </button>
        </div>
      )}

      {/* 追加フォーム */}
      <Card>
        <CardHeader>
          <CardTitle>管理者を追加</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              type="email"
              placeholder="メールアドレス"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1"
            />
            <Button onClick={handleAdd} disabled={adding || !newEmail.trim()}>
              {adding ? "追加中..." : "追加"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 管理者一覧 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>管理者一覧（{admins.length}件）</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchAdmins}>
            更新
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              読み込み中...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>メールアドレス</TableHead>
                  <TableHead>ソース</TableHead>
                  <TableHead>追加者</TableHead>
                  <TableHead>追加日時</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      スーパー管理者がいません
                    </TableCell>
                  </TableRow>
                ) : (
                  admins.map((admin) => (
                    <TableRow key={admin.email}>
                      <TableCell className="font-mono">
                        {admin.email}
                        {admin.email === user?.email && (
                          <Badge variant="outline" className="ml-2">
                            あなた
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={admin.source === "env" ? "secondary" : "default"}
                        >
                          {admin.source === "env" ? "環境変数" : "Firestore"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {admin.addedBy || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(admin.addedAt)}
                      </TableCell>
                      <TableCell>
                        {admin.source === "firestore" && admin.email !== user?.email ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteTarget(admin)}
                          >
                            削除
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {admin.source === "env" ? "削除不可" : "-"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 削除確認ダイアログ */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>スーパー管理者を削除</DialogTitle>
            <DialogDescription>
              本当に{deleteTarget?.email}をスーパー管理者から削除しますか？
              この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "削除中..." : "削除する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
