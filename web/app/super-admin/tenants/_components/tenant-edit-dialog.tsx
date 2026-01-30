"use client";

import { useState, useEffect } from "react";
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

interface TenantEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null;
  onSave: (id: string, data: { name: string; ownerEmail: string }) => Promise<void>;
}

/**
 * テナント編集ダイアログ
 */
export function TenantEditDialog({
  open,
  onOpenChange,
  tenant,
  onSave,
}: TenantEditDialogProps) {
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // テナントが変わったらフォームをリセット
  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      setOwnerEmail(tenant.ownerEmail);
      setError(null);
    }
  }, [tenant]);

  const validateForm = (): string | null => {
    if (!name.trim()) {
      return "組織名を入力してください。";
    }
    if (name.length > 100) {
      return "組織名は100文字以内で入力してください。";
    }
    if (!ownerEmail.trim()) {
      return "オーナーメールアドレスを入力してください。";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ownerEmail)) {
      return "有効なメールアドレス形式で入力してください。";
    }
    return null;
  };

  const hasChanges = () => {
    if (!tenant) return false;
    return name.trim() !== tenant.name || ownerEmail.trim().toLowerCase() !== tenant.ownerEmail.toLowerCase();
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!hasChanges()) {
      setError("変更がありません。");
      return;
    }

    if (!tenant) return;

    setLoading(true);
    setError(null);

    try {
      await onSave(tenant.id, {
        name: name.trim(),
        ownerEmail: ownerEmail.trim(),
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>テナント情報を編集</DialogTitle>
          <DialogDescription>
            テナントID: <span className="font-mono">{tenant.id}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">組織名</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="組織名を入力"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerEmail">オーナーメールアドレス</Label>
            <Input
              id="ownerEmail"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@example.com"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}
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
            onClick={handleSave}
            disabled={loading || !hasChanges()}
          >
            {loading ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
