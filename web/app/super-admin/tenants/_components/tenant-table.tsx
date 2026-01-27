"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TenantStatusDialog } from "./tenant-status-dialog";

export interface Tenant {
  id: string;
  name: string;
  ownerEmail: string;
  status: "active" | "suspended";
  createdAt: string | null;
  updatedAt: string | null;
}

interface TenantTableProps {
  tenants: Tenant[];
  onStatusChange: (id: string, newStatus: "active" | "suspended") => Promise<void>;
}

/**
 * テナント一覧テーブル
 */
export function TenantTable({ tenants, onStatusChange }: TenantTableProps) {
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<"active" | "suspended">("active");

  const handleStatusClick = (tenant: Tenant, newStatus: "active" | "suspended") => {
    setSelectedTenant(tenant);
    setTargetStatus(newStatus);
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (selectedTenant) {
      await onStatusChange(selectedTenant.id, targetStatus);
    }
    setDialogOpen(false);
    setSelectedTenant(null);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>テナントID</TableHead>
            <TableHead>組織名</TableHead>
            <TableHead>オーナー</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>作成日時</TableHead>
            <TableHead>リンク</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                テナントがありません
              </TableCell>
            </TableRow>
          ) : (
            tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell className="font-mono text-sm">{tenant.id}</TableCell>
                <TableCell>{tenant.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {tenant.ownerEmail}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={tenant.status === "active" ? "default" : "destructive"}
                  >
                    {tenant.status === "active" ? "有効" : "停止中"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(tenant.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/${tenant.id}/admin`} target="_blank">
                        管理
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/${tenant.id}/student`} target="_blank">
                        受講
                      </Link>
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  {tenant.status === "active" ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleStatusClick(tenant, "suspended")}
                    >
                      停止
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleStatusClick(tenant, "active")}
                    >
                      再開
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <TenantStatusDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenant={selectedTenant}
        targetStatus={targetStatus}
        onConfirm={handleConfirm}
      />
    </>
  );
}
