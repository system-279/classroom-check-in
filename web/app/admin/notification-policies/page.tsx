"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import type { NotificationPolicy } from "@/types/notification-policy";
import type { Course } from "@/types/course";
import type { User } from "@/types/user";
import { PolicyTable } from "./_components/policy-table";
import { PolicyFormDialog } from "./_components/policy-form-dialog";

export default function NotificationPoliciesPage() {
  const [policies, setPolicies] = useState<NotificationPolicy[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<NotificationPolicy | null>(
    null
  );

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [policiesRes, coursesRes, usersRes] = await Promise.all([
        apiFetch<{ policies: NotificationPolicy[] }>(
          "/api/v1/admin/notification-policies"
        ),
        apiFetch<{ courses: Course[] }>("/api/v1/admin/courses"),
        apiFetch<{ users: User[] }>("/api/v1/admin/users"),
      ]);
      setPolicies(policiesRes.policies);
      setCourses(coursesRes.courses);
      setUsers(usersRes.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = () => {
    setEditingPolicy(null);
    setDialogOpen(true);
  };

  const handleEdit = (policy: NotificationPolicy) => {
    setEditingPolicy(policy);
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    setDialogOpen(false);
    setEditingPolicy(null);
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">通知ポリシー管理</h1>
          <p className="text-sm text-muted-foreground">
            OUT忘れ通知のルールを設定します
          </p>
        </div>
        <Button onClick={handleCreate}>新規作成</Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground">読み込み中...</div>
      ) : (
        <PolicyTable
          policies={policies}
          courses={courses}
          users={users}
          onEdit={handleEdit}
          onDelete={fetchData}
        />
      )}

      <PolicyFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        policy={editingPolicy}
        courses={courses}
        users={users}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
