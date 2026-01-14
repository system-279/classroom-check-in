"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api";
import type { Course, CourseInput } from "@/types/course";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course | null;
  onSuccess: () => void;
};

export function CourseFormDialog({
  open,
  onOpenChange,
  course,
  onSuccess,
}: Props) {
  const [name, setName] = useState("");
  const [classroomUrl, setClassroomUrl] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [visible, setVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!course;

  useEffect(() => {
    if (open) {
      if (course) {
        setName(course.name);
        setClassroomUrl(course.classroomUrl ?? "");
        setDescription(course.description ?? "");
        setNote(course.note ?? "");
        setEnabled(course.enabled);
        setVisible(course.visible);
      } else {
        setName("");
        setClassroomUrl("");
        setDescription("");
        setNote("");
        setEnabled(true);
        setVisible(true);
      }
      setError(null);
    }
  }, [open, course]);

  // enabled=falseの場合、visibleを自動的にfalseにする
  useEffect(() => {
    if (!enabled && visible) {
      setVisible(false);
    }
  }, [enabled, visible]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: CourseInput = {
      name,
      classroomUrl: classroomUrl || null,
      description: description || null,
      note: note || null,
      enabled,
      visible,
    };

    try {
      if (isEditing) {
        await apiFetch(`/api/v1/admin/courses/${course.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/v1/admin/courses", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "講座を編集" : "新規講座"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">講座名 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="classroomUrl">Classroom URL</Label>
            <Input
              id="classroomUrl"
              type="url"
              value={classroomUrl}
              onChange={(e) => setClassroomUrl(e.target.value)}
              placeholder="https://classroom.google.com/..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">説明</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">管理用メモ</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="enabled">有効</Label>
              <p className="text-sm text-muted-foreground">
                無効にすると入退室の対象外になります
              </p>
            </div>
            <Switch
              id="enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="visible">表示</Label>
              <p className="text-sm text-muted-foreground">
                受講者の講座一覧に表示するかどうか
              </p>
            </div>
            <Switch
              id="visible"
              checked={visible}
              onCheckedChange={setVisible}
              disabled={!enabled}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
