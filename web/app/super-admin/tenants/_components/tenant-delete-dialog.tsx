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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Tenant } from "./tenant-table";

interface TenantDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null;
  onConfirm: () => Promise<void>;
}

/**
 * テナント削除確認ダイアログ
 * 誤操作防止のため、テナントIDの手入力による確認を要求
 */
export function TenantDeleteDialog({
  open,
  onOpenChange,
  tenant,
  onConfirm,
}: TenantDeleteDialogProps) {
  const [confirmId, setConfirmId] = useState("");
  const [loading, setLoading] = useState(false);

  const isMatch = tenant ? confirmId === tenant.id : false;

  const handleConfirm = async () => {
    if (!isMatch) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      setConfirmId("");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmId("");
    }
    onOpenChange(newOpen);
  };

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>テナントを削除しますか？</DialogTitle>
          <DialogDescription>
            この操作は取り消せません。テナント配下の全データ（ユーザー、講座、セッション等）が完全に削除されます。
          </DialogDescription>
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
        <div className="space-y-2 pt-2">
          <Label htmlFor="confirm-tenant-id">
            確認のため、テナントID <span className="font-mono font-bold">{tenant.id}</span> を入力してください
          </Label>
          <Input
            id="confirm-tenant-id"
            value={confirmId}
            onChange={(e) => setConfirmId(e.target.value)}
            placeholder={tenant.id}
            disabled={loading}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isMatch || loading}
          >
            {loading ? "削除中..." : "削除する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
