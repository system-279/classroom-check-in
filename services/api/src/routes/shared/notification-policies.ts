/**
 * 通知ポリシー関連の共通ルーター
 * DataSourceを使用してデモ/本番両対応
 */

import { Router, Request, Response } from "express";
import { requireAdmin } from "../../middleware/auth.js";
import { toISOString } from "../../utils/date.js";

const router = Router();

/**
 * 管理者向け: 通知ポリシー一覧取得
 * GET /admin/notification-policies
 */
router.get("/admin/notification-policies", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const scope = req.query.scope as "global" | "course" | "user" | undefined;
    const active = req.query.active === "true" ? true : req.query.active === "false" ? false : undefined;

    const policies = await ds.getNotificationPolicies({ scope, active });

    res.json({
      policies: policies.map((p) => ({
        id: p.id,
        scope: p.scope,
        courseId: p.courseId,
        userId: p.userId,
        firstNotifyAfterMin: p.firstNotifyAfterMin,
        repeatIntervalHours: p.repeatIntervalHours,
        maxRepeatDays: p.maxRepeatDays,
        active: p.active,
        createdAt: toISOString(p.createdAt),
        updatedAt: toISOString(p.updatedAt),
      })),
    });
  } catch (error) {
    console.error("Error fetching notification policies:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to fetch notification policies" });
  }
});

/**
 * 管理者向け: 通知ポリシー作成
 * POST /admin/notification-policies
 */
router.post("/admin/notification-policies", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const {
      scope,
      courseId,
      userId,
      firstNotifyAfterMin,
      repeatIntervalHours,
      maxRepeatDays,
      active,
    } = req.body;

    // バリデーション
    const validScopes = ["global", "course", "user"];
    if (!scope || !validScopes.includes(scope)) {
      res.status(400).json({ error: "invalid_scope", message: "scope must be global, course, or user" });
      return;
    }

    if (scope === "course" && !courseId) {
      res.status(400).json({ error: "invalid_course_id", message: "courseId is required for course scope" });
      return;
    }

    if (scope === "user" && !userId) {
      res.status(400).json({ error: "invalid_user_id", message: "userId is required for user scope" });
      return;
    }

    if (firstNotifyAfterMin !== undefined && (typeof firstNotifyAfterMin !== "number" || firstNotifyAfterMin < 0)) {
      res.status(400).json({ error: "invalid_first_notify", message: "firstNotifyAfterMin must be a non-negative number" });
      return;
    }

    if (repeatIntervalHours !== undefined && (typeof repeatIntervalHours !== "number" || repeatIntervalHours <= 0)) {
      res.status(400).json({ error: "invalid_repeat_interval", message: "repeatIntervalHours must be a positive number" });
      return;
    }

    if (maxRepeatDays !== undefined && (typeof maxRepeatDays !== "number" || maxRepeatDays < 0)) {
      res.status(400).json({ error: "invalid_max_repeat", message: "maxRepeatDays must be a non-negative number" });
      return;
    }

    const policy = await ds.createNotificationPolicy({
      scope,
      courseId: scope === "course" ? courseId : null,
      userId: scope === "user" ? userId : null,
      firstNotifyAfterMin: firstNotifyAfterMin ?? 60,
      repeatIntervalHours: repeatIntervalHours ?? 24,
      maxRepeatDays: maxRepeatDays ?? 7,
      active: active ?? true,
    });

    res.status(201).json({
      policy: {
        id: policy.id,
        scope: policy.scope,
        courseId: policy.courseId,
        userId: policy.userId,
        firstNotifyAfterMin: policy.firstNotifyAfterMin,
        repeatIntervalHours: policy.repeatIntervalHours,
        maxRepeatDays: policy.maxRepeatDays,
        active: policy.active,
        createdAt: toISOString(policy.createdAt),
        updatedAt: toISOString(policy.updatedAt),
      },
    });
  } catch (error) {
    console.error("Error creating notification policy:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to create notification policy" });
  }
});

/**
 * 管理者向け: 通知ポリシー更新
 * PATCH /admin/notification-policies/:id
 */
router.patch("/admin/notification-policies/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const id = req.params.id as string;
    const {
      firstNotifyAfterMin,
      repeatIntervalHours,
      maxRepeatDays,
      active,
    } = req.body;

    const existing = await ds.getNotificationPolicyById(id);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Notification policy not found" });
      return;
    }

    // バリデーション
    if (firstNotifyAfterMin !== undefined && (typeof firstNotifyAfterMin !== "number" || firstNotifyAfterMin < 0)) {
      res.status(400).json({ error: "invalid_first_notify", message: "firstNotifyAfterMin must be a non-negative number" });
      return;
    }

    if (repeatIntervalHours !== undefined && (typeof repeatIntervalHours !== "number" || repeatIntervalHours <= 0)) {
      res.status(400).json({ error: "invalid_repeat_interval", message: "repeatIntervalHours must be a positive number" });
      return;
    }

    if (maxRepeatDays !== undefined && (typeof maxRepeatDays !== "number" || maxRepeatDays < 0)) {
      res.status(400).json({ error: "invalid_max_repeat", message: "maxRepeatDays must be a non-negative number" });
      return;
    }

    const policy = await ds.updateNotificationPolicy(id, {
      ...(firstNotifyAfterMin !== undefined && { firstNotifyAfterMin }),
      ...(repeatIntervalHours !== undefined && { repeatIntervalHours }),
      ...(maxRepeatDays !== undefined && { maxRepeatDays }),
      ...(active !== undefined && { active }),
    });

    res.json({
      policy: {
        id: policy!.id,
        scope: policy!.scope,
        courseId: policy!.courseId,
        userId: policy!.userId,
        firstNotifyAfterMin: policy!.firstNotifyAfterMin,
        repeatIntervalHours: policy!.repeatIntervalHours,
        maxRepeatDays: policy!.maxRepeatDays,
        active: policy!.active,
        createdAt: toISOString(policy!.createdAt),
        updatedAt: toISOString(policy!.updatedAt),
      },
    });
  } catch (error) {
    console.error("Error updating notification policy:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to update notification policy" });
  }
});

/**
 * 管理者向け: 通知ポリシー削除
 * DELETE /admin/notification-policies/:id
 */
router.delete("/admin/notification-policies/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const id = req.params.id as string;

    const existing = await ds.getNotificationPolicyById(id);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Notification policy not found" });
      return;
    }

    await ds.deleteNotificationPolicy(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting notification policy:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to delete notification policy" });
  }
});

export const notificationPoliciesRouter = router;
