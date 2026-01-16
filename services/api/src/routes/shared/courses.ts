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
    const courses = await ds.getCourses({ enabled: true, visible: true });

    // セッションサマリーを取得
    const coursesWithSummary = await Promise.all(
      courses.map(async (course) => {
        const sessions = await ds.getSessions({
          courseId: course.id,
          userId: req.user!.id,
        });

        const activeSession = sessions.find((s) => s.status === "open");
        const closedSessions = sessions.filter((s) => s.status === "closed");

        return {
          id: course.id,
          name: course.name,
          description: course.description,
          classroomUrl: course.classroomUrl,
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
      })
    );

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
    const { name, description, classroomUrl, enabled, visible, note } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      res.status(400).json({ error: "invalid_name", message: "name is required" });
      return;
    }

    const course = await ds.createCourse({
      name: name.trim(),
      description: description ?? null,
      classroomUrl: classroomUrl ?? null,
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
    const { name, description, classroomUrl, enabled, visible, note } = req.body;

    const existing = await ds.getCourseById(id);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Course not found" });
      return;
    }

    const course = await ds.updateCourse(id, {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(classroomUrl !== undefined && { classroomUrl }),
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
