"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TenantTable, type Tenant } from "./_components/tenant-table";

interface TenantListResponse {
  tenants: Tenant[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

const LIMIT = 20;

/**
 * テナント管理ページ
 */
export default function TenantsPage() {
  const { getIdToken } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [pagination, setPagination] = useState({
    total: 0,
    offset: 0,
    hasMore: false,
  });

  const fetchTenants = useCallback(async (offset = 0, status?: string) => {
    setLoading(true);
    setError(null);
    try {
      const idToken = await getIdToken();
      if (!idToken) {
        throw new Error("認証トークンを取得できませんでした");
      }

      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(offset),
        sort: "createdAt",
        order: "desc",
      });
      if (status && status !== "all") {
        params.set("status", status);
      }

      const data = await apiFetch<TenantListResponse>(
        `/api/v2/super/tenants?${params}`,
        { idToken }
      );

      setTenants(data.tenants);
      setPagination({
        total: data.pagination.total,
        offset: data.pagination.offset,
        hasMore: data.pagination.hasMore,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    fetchTenants(0, statusFilter);
  }, [fetchTenants, statusFilter]);

  const handleStatusChange = async (id: string, newStatus: "active" | "suspended") => {
    try {
      const idToken = await getIdToken();
      if (!idToken) {
        throw new Error("認証トークンを取得できませんでした");
      }

      await apiFetch(`/api/v2/super/tenants/${id}`, {
        method: "PATCH",
        idToken,
        body: JSON.stringify({ status: newStatus }),
        headers: { "Content-Type": "application/json" },
      });

      // 再取得
      await fetchTenants(pagination.offset, statusFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ステータス変更に失敗しました");
    }
  };

  const handleEdit = async (id: string, data: { name: string; ownerEmail: string }) => {
    const idToken = await getIdToken();
    if (!idToken) {
      throw new Error("認証トークンを取得できませんでした");
    }

    await apiFetch(`/api/v2/super/tenants/${id}`, {
      method: "PATCH",
      idToken,
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
    });

    // 再取得
    await fetchTenants(pagination.offset, statusFilter);
  };

  const handleDelete = async (id: string) => {
    try {
      const idToken = await getIdToken();
      if (!idToken) {
        throw new Error("認証トークンを取得できませんでした");
      }

      await apiFetch(`/api/v2/super/tenants/${id}`, {
        method: "DELETE",
        idToken,
      });

      // 再取得
      await fetchTenants(pagination.offset, statusFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "テナントの削除に失敗しました");
    }
  };

  const handlePrevPage = () => {
    const newOffset = Math.max(0, pagination.offset - LIMIT);
    fetchTenants(newOffset, statusFilter);
  };

  const handleNextPage = () => {
    if (pagination.hasMore) {
      fetchTenants(pagination.offset + LIMIT, statusFilter);
    }
  };

  const currentPage = Math.floor(pagination.offset / LIMIT) + 1;
  const totalPages = Math.ceil(pagination.total / LIMIT);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">テナント管理</h1>
        <p className="text-muted-foreground mt-2">
          全テナントの一覧と管理
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-medium">
            テナント一覧（{pagination.total}件）
          </CardTitle>
          <div className="flex items-center gap-4">
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="ステータス" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="active">有効のみ</SelectItem>
                <SelectItem value="suspended">停止中のみ</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchTenants(pagination.offset, statusFilter)}
              disabled={loading}
            >
              更新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              読み込み中...
            </div>
          ) : (
            <TenantTable
              tenants={tenants}
              onStatusChange={handleStatusChange}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {pagination.offset + 1}〜{Math.min(pagination.offset + LIMIT, pagination.total)}件
                / {pagination.total}件
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={pagination.offset === 0 || loading}
                >
                  前のページ
                </Button>
                <span className="flex items-center px-3 text-sm">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!pagination.hasMore || loading}
                >
                  次のページ
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
