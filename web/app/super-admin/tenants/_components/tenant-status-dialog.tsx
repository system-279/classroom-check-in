"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Tenant } from "./tenant-table";

interface TenantStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null;
  targetStatus: "active" | "suspended";
  onConfirm: () => Promise<void>;
}

/**
 * テナントステータス変更確認ダイアログ
 */
export function TenantStatusDialog({
  open,
  onOpenChange,
  tenant,
  targetStatus,
  onConfirm,
}: TenantStatusDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  if (!tenant) return null;

  const isSuspending = targetStatus === "suspended";
  const title = isSuspending ? "テナントを停止しますか？" : "テナントを再開しますか？";
  const description = isSuspending
    ? `「${tenant.name}」を停止すると、このテナントの全ユーザーがアクセスできなくなります。`
    : `「${tenant.name}」を再開すると、このテナントのユーザーが再びアクセスできるようになります。`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">テナントID:</span>
            <span className="font-mono">{tenant.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">組織名:</span>
            <span>{tenant.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">オーナー:</span>
            <span>{tenant.ownerEmail}</span>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            キャンセル
          </Button>
          <Button
            variant={isSuspending ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "処理中..." : isSuspending ? "停止する" : "再開する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
