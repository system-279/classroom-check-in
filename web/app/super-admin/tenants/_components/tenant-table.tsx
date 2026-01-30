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
import { TenantEditDialog } from "./tenant-edit-dialog";

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
  onEdit: (id: string, data: { name: string; ownerEmail: string }) => Promise<void>;
}

/**
 * テナント一覧テーブル
 */
export function TenantTable({ tenants, onStatusChange, onEdit }: TenantTableProps) {
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<"active" | "suspended">("active");

  const handleStatusClick = (tenant: Tenant, newStatus: "active" | "suspended") => {
    setSelectedTenant(tenant);
    setTargetStatus(newStatus);
    setStatusDialogOpen(true);
  };

  const handleEditClick = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setEditDialogOpen(true);
  };

  const handleStatusConfirm = async () => {
    if (selectedTenant) {
      await onStatusChange(selectedTenant.id, targetStatus);
    }
    setStatusDialogOpen(false);
    setSelectedTenant(null);
  };

  const handleEditSave = async (id: string, data: { name: string; ownerEmail: string }) => {
    await onEdit(id, data);
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
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditClick(tenant)}
                    >
                      編集
                    </Button>
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
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <TenantStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        tenant={selectedTenant}
        targetStatus={targetStatus}
        onConfirm={handleStatusConfirm}
      />

      <TenantEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        tenant={selectedTenant}
        onSave={handleEditSave}
      />
    </>
  );
}
