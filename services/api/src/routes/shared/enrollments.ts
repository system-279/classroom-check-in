/**
 * 受講登録関連の共通ルーター
 * DataSourceを使用してデモ/本番両対応
 */

import { Router, Request, Response } from "express";
import { requireAdmin } from "../../middleware/auth.js";
import { toISOString } from "../../utils/date.js";

const router = Router();

/**
 * 管理者向け: 受講登録一覧取得
 * GET /admin/enrollments
 */
router.get("/admin/enrollments", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const courseId = req.query.courseId as string | undefined;
    const userId = req.query.userId as string | undefined;

    const enrollments = await ds.getEnrollments({ courseId, userId });

    res.json({
      enrollments: enrollments.map((e) => ({
        id: e.id,
        courseId: e.courseId,
        userId: e.userId,
        role: e.role,
        startAt: toISOString(e.startAt),
        endAt: toISOString(e.endAt),
        createdAt: toISOString(e.createdAt),
      })),
    });
  } catch (error) {
    console.error("Error fetching enrollments:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to fetch enrollments" });
  }
});

/**
 * 管理者向け: 受講登録作成
 * POST /admin/enrollments
 */
router.post("/admin/enrollments", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const { courseId, userId, role, startAt, endAt } = req.body;

    if (!courseId) {
      res.status(400).json({ error: "invalid_course_id", message: "courseId is required" });
      return;
    }

    if (!userId) {
      res.status(400).json({ error: "invalid_user_id", message: "userId is required" });
      return;
    }

    // 講座の存在確認
    const course = await ds.getCourseById(courseId);
    if (!course) {
      res.status(404).json({ error: "course_not_found", message: "Course not found" });
      return;
    }

    // ユーザーの存在確認
    const user = await ds.getUserById(userId);
    if (!user) {
      res.status(404).json({ error: "user_not_found", message: "User not found" });
      return;
    }

    // 重複チェック
    const existing = await ds.getEnrollments({ courseId, userId });
    if (existing.length > 0) {
      res.status(409).json({ error: "enrollment_exists", message: "User is already enrolled in this course" });
      return;
    }

    const enrollment = await ds.createEnrollment({
      courseId,
      userId,
      role: role ?? "student",
      startAt: startAt ? new Date(startAt) : new Date(),
      endAt: endAt ? new Date(endAt) : null,
    });

    res.status(201).json({
      enrollment: {
        id: enrollment.id,
        courseId: enrollment.courseId,
        userId: enrollment.userId,
        role: enrollment.role,
        startAt: toISOString(enrollment.startAt),
        endAt: toISOString(enrollment.endAt),
        createdAt: toISOString(enrollment.createdAt),
      },
    });
  } catch (error) {
    console.error("Error creating enrollment:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to create enrollment" });
  }
});

/**
 * 管理者向け: 受講登録更新
 * PATCH /admin/enrollments/:id
 */
router.patch("/admin/enrollments/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const id = req.params.id as string;
    const { role, startAt, endAt } = req.body;

    const existing = await ds.getEnrollmentById(id);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Enrollment not found" });
      return;
    }

    const enrollment = await ds.updateEnrollment(id, {
      ...(role !== undefined && { role }),
      ...(startAt !== undefined && { startAt: new Date(startAt) }),
      ...(endAt !== undefined && { endAt: endAt ? new Date(endAt) : null }),
    });

    res.json({
      enrollment: {
        id: enrollment!.id,
        courseId: enrollment!.courseId,
        userId: enrollment!.userId,
        role: enrollment!.role,
        startAt: toISOString(enrollment!.startAt),
        endAt: toISOString(enrollment!.endAt),
        createdAt: toISOString(enrollment!.createdAt),
      },
    });
  } catch (error) {
    console.error("Error updating enrollment:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to update enrollment" });
  }
});

/**
 * 管理者向け: 受講登録削除
 * DELETE /admin/enrollments/:id
 */
router.delete("/admin/enrollments/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const id = req.params.id as string;

    const existing = await ds.getEnrollmentById(id);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Enrollment not found" });
      return;
    }

    await ds.deleteEnrollment(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting enrollment:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to delete enrollment" });
  }
});

export const enrollmentsRouter = router;
