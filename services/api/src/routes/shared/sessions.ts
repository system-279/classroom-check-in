/**
 * セッション関連の共通ルーター
 * DataSourceを使用してデモ/本番両対応
 */

import { Router, Request, Response } from "express";
import { requireUser, requireAdmin } from "../../middleware/auth.js";
import { toISOString } from "../../utils/date.js";

/**
 * 滞在時間（秒）を計算
 * endTimeがstartTimeより前の場合は0を返す（負値防止）
 */
function calculateDurationSec(startTime: Date, endTime: Date): number {
  const durationMs = endTime.getTime() - startTime.getTime();
  return Math.max(0, Math.floor(durationMs / 1000));
}

const router = Router();

// セッションレスポンスの共通フォーマット
function formatSession(session: {
  id: string;
  courseId: string;
  userId: string;
  startTime: Date;
  endTime: Date | null;
  durationSec: number;
  source: string;
  confidence: number | null;
  status: string;
  lastHeartbeatAt: Date | null;
}) {
  return {
    id: session.id,
    courseId: session.courseId,
    userId: session.userId,
    startTime: toISOString(session.startTime),
    endTime: toISOString(session.endTime),
    durationSec: session.durationSec,
    source: session.source,
    confidence: session.confidence,
    status: session.status,
    lastHeartbeatAt: toISOString(session.lastHeartbeatAt),
  };
}

/**
 * 受講者向け: アクティブセッション取得
 * GET /sessions/active
 */
router.get("/sessions/active", requireUser, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const courseId = req.query.courseId as string | undefined;

    const session = await ds.getActiveSession(req.user!.id, courseId);

    if (!session) {
      res.json({ session: null });
      return;
    }

    res.json({ session: formatSession(session) });
  } catch (error) {
    console.error("Error fetching active session:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to fetch active session" });
  }
});

/**
 * 受講者向け: チェックイン（IN）
 * POST /sessions/check-in
 */
router.post("/sessions/check-in", requireUser, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const { courseId } = req.body;

    if (!courseId) {
      res.status(400).json({ error: "invalid_course_id", message: "courseId is required" });
      return;
    }

    // 講座の存在確認
    const course = await ds.getCourseById(courseId);
    if (!course || !course.enabled || !course.visible) {
      res.status(404).json({ error: "course_not_found", message: "Course not found or not available" });
      return;
    }

    // アトミックなチェックイン（排他制御: 同時リクエストによる重複作成を防止）
    const now = new Date();
    const { session, isExisting } = await ds.checkInOrGetExisting(
      req.user!.id,
      courseId,
      {
        courseId,
        userId: req.user!.id,
        startTime: now,
        endTime: null,
        durationSec: 0,
        source: "manual",
        confidence: null,
        status: "open",
        lastHeartbeatAt: now,
      },
    );

    res.status(isExisting ? 200 : 201).json({
      session: formatSession(session),
      isExisting,
    });
  } catch (error) {
    console.error("Error checking in:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to check in" });
  }
});

/**
 * 受講者向け: ハートビート
 * POST /sessions/heartbeat
 */
router.post("/sessions/heartbeat", requireUser, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: "invalid_session_id", message: "sessionId is required" });
      return;
    }

    const session = await ds.getSessionById(sessionId);
    if (!session) {
      res.status(404).json({ error: "session_not_found", message: "Session not found" });
      return;
    }

    if (session.userId !== req.user!.id) {
      res.status(403).json({ error: "forbidden", message: "Not your session" });
      return;
    }

    if (session.status !== "open") {
      res.status(400).json({ error: "session_closed", message: "Session is already closed" });
      return;
    }

    const updated = await ds.updateSession(sessionId, {
      lastHeartbeatAt: new Date(),
    });

    res.json({ session: formatSession(updated!) });
  } catch (error) {
    console.error("Error updating heartbeat:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to update heartbeat" });
  }
});

/**
 * 受講者向け: チェックアウト（OUT）
 * POST /sessions/check-out
 */
router.post("/sessions/check-out", requireUser, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: "invalid_session_id", message: "sessionId is required" });
      return;
    }

    const session = await ds.getSessionById(sessionId);
    if (!session) {
      res.status(404).json({ error: "session_not_found", message: "Session not found" });
      return;
    }

    if (session.userId !== req.user!.id) {
      res.status(403).json({ error: "forbidden", message: "Not your session" });
      return;
    }

    if (session.status !== "open") {
      res.status(400).json({ error: "session_closed", message: "Session is already closed" });
      return;
    }

    const endTime = new Date();
    const durationSec = calculateDurationSec(session.startTime, endTime);

    const updated = await ds.updateSession(sessionId, {
      endTime,
      durationSec,
      status: "closed",
      lastHeartbeatAt: endTime,
    });

    res.json({ session: formatSession(updated!) });
  } catch (error) {
    console.error("Error checking out:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to check out" });
  }
});

/**
 * 管理者向け: セッション一覧取得
 * GET /admin/sessions
 */
router.get("/admin/sessions", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const courseId = req.query.courseId as string | undefined;
    const userId = req.query.userId as string | undefined;
    const status = req.query.status as "open" | "closed" | undefined;

    const sessions = await ds.getSessions({ courseId, userId, status });

    res.json({
      sessions: sessions.map(formatSession),
    });
  } catch (error) {
    console.error("Error fetching admin sessions:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to fetch sessions" });
  }
});

/**
 * 管理者向け: セッション強制終了
 * POST /admin/sessions/:id/close
 */
router.post("/admin/sessions/:id/close", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const id = req.params.id as string;
    const { endTime: endTimeStr } = req.body;

    const session = await ds.getSessionById(id);
    if (!session) {
      res.status(404).json({ error: "session_not_found", message: "Session not found" });
      return;
    }

    if (session.status !== "open") {
      res.status(400).json({ error: "session_closed", message: "Session is already closed" });
      return;
    }

    const endTime = endTimeStr ? new Date(endTimeStr) : new Date();
    const durationSec = calculateDurationSec(session.startTime, endTime);

    const updated = await ds.updateSession(id, {
      endTime,
      durationSec,
      status: "closed",
    });

    res.json({ session: formatSession(updated!) });
  } catch (error) {
    console.error("Error closing session:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to close session" });
  }
});

export const sessionsRouter = router;
