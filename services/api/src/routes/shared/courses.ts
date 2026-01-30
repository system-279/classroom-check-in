/**
 * 講座関連の共通ルーター
 * DataSourceを使用してデモ/本番両対応
 */

import { Router, Request, Response } from "express";
import { requireUser, requireAdmin } from "../../middleware/auth.js";
import { toISOString } from "../../utils/date.js";

const router = Router();

/**
 * 受講者向け: 講座一覧取得
 * GET /courses
 *
 * 受講登録済みの講座のみを返す
 */
router.get("/courses", requireUser, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;

    const isAdmin = req.user!.role === "admin";

    // デバッグ: ユーザーIDをログ出力
    console.log("[DEBUG] GET /courses - userId:", req.user!.id, "email:", req.user!.email, "isAdmin:", isAdmin);

    // N+1解消: 講座一覧、受講登録、ユーザーのセッションを並列取得
    const [courses, enrollments, userSessions] = await Promise.all([
      ds.getCourses({ enabled: true, visible: true }),
      ds.getEnrollments({ userId: req.user!.id }),
      ds.getSessions({ userId: req.user!.id }),
    ]);

    // デバッグ: 取得結果をログ出力
    console.log("[DEBUG] GET /courses - courses:", courses.length, "enrollments:", enrollments.length);
    if (enrollments.length > 0) {
      console.log("[DEBUG] GET /courses - enrolledCourseIds:", enrollments.map((e) => e.courseId));
    }

    // 受講登録済みの講座IDセット
    const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));

    // 管理者は全講座を表示、それ以外は受講登録済みの講座のみ
    const enrolledCourses = isAdmin
      ? courses
      : courses.filter((course) => enrolledCourseIds.has(course.id));

    // セッションをコース別にグルーピング
    const sessionsByCourse = new Map<string, typeof userSessions>();
    for (const session of userSessions) {
      const existing = sessionsByCourse.get(session.courseId) || [];
      existing.push(session);
      sessionsByCourse.set(session.courseId, existing);
    }

    // 各講座にセッションサマリーを付与
    const coursesWithSummary = enrolledCourses.map((course) => {
      const sessions = sessionsByCourse.get(course.id) || [];
      const activeSession = sessions.find((s) => s.status === "open");
      const closedSessions = sessions.filter((s) => s.status === "closed");

      return {
        id: course.id,
        name: course.name,
        description: course.description,
        classroomUrl: course.classroomUrl,
        requiredWatchMin: course.requiredWatchMin,
        enabled: course.enabled,
        visible: course.visible,
        sessionSummary: {
          lastSessionAt: closedSessions.length > 0
            ? toISOString(closedSessions[0].startTime)
            : null,
          totalDurationSec: closedSessions.reduce((sum, s) => sum + s.durationSec, 0),
          sessionCount: closedSessions.length,
          hasActiveSession: !!activeSession,
          isCompleted: closedSessions.length > 0, // ADR-0026: 受講済みフラグ
        },
      };
    });

    res.json({ courses: coursesWithSummary });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to fetch courses" });
  }
});

/**
 * 管理者向け: 講座一覧取得
 * GET /admin/courses
 */
router.get("/admin/courses", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const courses = await ds.getCourses();

    const result = courses.map((course) => ({
      id: course.id,
      name: course.name,
      description: course.description,
      classroomUrl: course.classroomUrl,
      requiredWatchMin: course.requiredWatchMin,
      enabled: course.enabled,
      visible: course.visible,
      note: course.note,
      createdAt: toISOString(course.createdAt),
      updatedAt: toISOString(course.updatedAt),
    }));

    res.json({ courses: result });
  } catch (error) {
    console.error("Error fetching admin courses:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to fetch courses" });
  }
});

/**
 * 管理者向け: 講座作成
 * POST /admin/courses
 */
router.post("/admin/courses", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const { name, description, classroomUrl, requiredWatchMin, enabled, visible, note } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      res.status(400).json({ error: "invalid_name", message: "name is required" });
      return;
    }

    const course = await ds.createCourse({
      name: name.trim(),
      description: description ?? null,
      classroomUrl: classroomUrl ?? null,
      requiredWatchMin: requiredWatchMin ?? 63, // デフォルト63分
      enabled: enabled ?? true,
      visible: visible ?? true,
      note: note ?? null,
    });

    res.status(201).json({
      course: {
        id: course.id,
        name: course.name,
        description: course.description,
        classroomUrl: course.classroomUrl,
        requiredWatchMin: course.requiredWatchMin,
        enabled: course.enabled,
        visible: course.visible,
        note: course.note,
        createdAt: toISOString(course.createdAt),
        updatedAt: toISOString(course.updatedAt),
      },
    });
  } catch (error) {
    console.error("Error creating course:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to create course" });
  }
});

/**
 * 管理者向け: 講座更新
 * PATCH /admin/courses/:id
 */
router.patch("/admin/courses/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const id = req.params.id as string;
    const { name, description, classroomUrl, requiredWatchMin, enabled, visible, note } = req.body;

    const existing = await ds.getCourseById(id);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Course not found" });
      return;
    }

    const course = await ds.updateCourse(id, {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(classroomUrl !== undefined && { classroomUrl }),
      ...(requiredWatchMin !== undefined && { requiredWatchMin }),
      ...(enabled !== undefined && { enabled }),
      ...(visible !== undefined && { visible }),
      ...(note !== undefined && { note }),
    });

    res.json({
      course: {
        id: course!.id,
        name: course!.name,
        description: course!.description,
        classroomUrl: course!.classroomUrl,
        requiredWatchMin: course!.requiredWatchMin,
        enabled: course!.enabled,
        visible: course!.visible,
        note: course!.note,
        createdAt: toISOString(course!.createdAt),
        updatedAt: toISOString(course!.updatedAt),
      },
    });
  } catch (error) {
    console.error("Error updating course:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to update course" });
  }
});

/**
 * 管理者向け: 講座削除
 * DELETE /admin/courses/:id
 *
 * 関連データ（セッション、受講登録）がある場合は削除不可
 */
router.delete("/admin/courses/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const id = req.params.id as string;

    const existing = await ds.getCourseById(id);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Course not found" });
      return;
    }

    // 関連データのチェック
    const [sessions, enrollments] = await Promise.all([
      ds.getSessions({ courseId: id }),
      ds.getEnrollments({ courseId: id }),
    ]);

    const sessionCount = sessions.length;
    const enrollmentCount = enrollments.length;

    if (sessionCount > 0 || enrollmentCount > 0) {
      res.status(409).json({
        error: "has_related_data",
        message: "Cannot delete course: has related data",
        details: {
          sessionCount,
          enrollmentCount,
        },
      });
      return;
    }

    await ds.deleteCourse(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to delete course" });
  }
});

export const coursesRouter = router;
