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
 */
router.get("/courses", requireUser, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;

    // N+1解消: 講座一覧とユーザーの全セッションを並列取得
    const [courses, userSessions] = await Promise.all([
      ds.getCourses({ enabled: true, visible: true }),
      ds.getSessions({ userId: req.user!.id }),
    ]);

    // セッションをコース別にグルーピング
    const sessionsByCourse = new Map<string, typeof userSessions>();
    for (const session of userSessions) {
      const existing = sessionsByCourse.get(session.courseId) || [];
      existing.push(session);
      sessionsByCourse.set(session.courseId, existing);
    }

    // 各講座にセッションサマリーを付与
    const coursesWithSummary = courses.map((course) => {
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

    await ds.deleteCourse(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to delete course" });
  }
});

export const coursesRouter = router;
