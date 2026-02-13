"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuthFetch } from "@/lib/auth-fetch-context";
import { useAuth } from "@/lib/auth-context";
import { useTenantOptional } from "@/lib/tenant-context";
import type { NotificationPolicy } from "@/types/notification-policy";
import type { Course } from "@/types/course";
import type { User } from "@/types/user";
import { PolicyTable } from "./_components/policy-table";
import { PolicyFormDialog } from "./_components/policy-form-dialog";

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev";

export default function NotificationPoliciesPage() {
  const router = useRouter();
  const tenant = useTenantOptional();
  const authFetch = useAuthFetch();
  const { user: authUser, loading: authLoading } = useAuth();
  const [policies, setPolicies] = useState<NotificationPolicy[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<NotificationPolicy | null>(
    null
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [policiesRes, coursesRes, usersRes] = await Promise.all([
        authFetch<{ policies: NotificationPolicy[] }>(
          "/api/v1/admin/notification-policies"
        ),
        authFetch<{ courses: Course[] }>("/api/v1/admin/courses"),
        authFetch<{ users: User[] }>("/api/v1/admin/users"),
      ]);
      setPolicies(policiesRes.policies);
      setCourses(coursesRes.courses);
      setUsers(usersRes.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (AUTH_MODE === "firebase" && !authLoading && !authUser) {
      router.push(tenant ? `/${tenant.tenantId}` : "/");
      return;
    }
    if (AUTH_MODE === "firebase" && authLoading) {
      return;
    }
    fetchData();
  }, [authLoading, authUser, router, fetchData]);

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
