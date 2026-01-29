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

    // 受講登録の検証
    const enrollments = await ds.getEnrollments({ courseId, userId: req.user!.id });
    if (enrollments.length === 0) {
      res.status(403).json({ error: "not_enrolled", message: "You are not enrolled in this course" });
      return;
    }

    // ADR-0023: 同時セッション禁止（別講座で受講中の場合はエラー）
    const existingSession = await ds.getActiveSession(req.user!.id);
    if (existingSession && existingSession.courseId !== courseId) {
      const existingCourse = await ds.getCourseById(existingSession.courseId);
      res.status(409).json({
        error: "session_already_active",
        message: "You already have an active session in another course. Please finish it first.",
        existingSession: formatSession(existingSession),
        existingCourseName: existingCourse?.name ?? "Unknown",
      });
      return;
    }

    // ADR-0026: 同一講座への再入室禁止（closedセッションがある場合はエラー）
    const userSessions = await ds.getSessions({ userId: req.user!.id, courseId });
    const closedSession = userSessions.find((s) => s.status === "closed");
    if (closedSession) {
      res.status(403).json({
        error: "already_completed",
        message: "この講座は受講済みです。再度受講することはできません。",
        completedSession: formatSession(closedSession),
      });
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
 *
 * 条件:
 * - 本人のセッションであること
 * - セッションがopen状態であること
 * - 入室からrequiredWatchMin経過していること
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

    // 講座情報を取得してrequiredWatchMinを確認
    const course = await ds.getCourseById(session.courseId);
    if (!course) {
      res.status(400).json({ error: "course_not_found", message: "Course not found" });
      return;
    }

    // 必要視聴時間経過の確認
    const now = new Date();
    const requiredWatchMs = course.requiredWatchMin * 60 * 1000;
    const elapsedMs = now.getTime() - session.startTime.getTime();

    if (elapsedMs < requiredWatchMs) {
      const remainingSec = Math.ceil((requiredWatchMs - elapsedMs) / 1000);
      res.status(400).json({
        error: "not_enough_time",
        message: `Required watch time not reached. ${Math.ceil(remainingSec / 60)} minutes remaining.`,
        requiredWatchMin: course.requiredWatchMin,
        elapsedSec: Math.floor(elapsedMs / 1000),
        remainingSec,
      });
      return;
    }

    const endTime = now;
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
 * 受講者向け: セルフチェックアウト用情報取得
 * GET /sessions/self-checkout/:sessionId/info
 *
 * セルフチェックアウト画面に必要な情報を一括で返す
 */
router.get("/sessions/self-checkout/:sessionId/info", requireUser, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const sessionId = req.params.sessionId as string;

    // セッション存在確認
    const session = await ds.getSessionById(sessionId);
    if (!session) {
      res.status(404).json({ error: "session_not_found", message: "Session not found" });
      return;
    }

    // 本人確認
    if (session.userId !== req.user!.id) {
      res.status(403).json({ error: "not_owner", message: "Not your session" });
      return;
    }

    // 講座情報取得
    const course = await ds.getCourseById(session.courseId);
    if (!course) {
      res.status(400).json({ error: "course_not_found", message: "Course not found" });
      return;
    }

    // 通知送信済み確認
    const notificationLog = await ds.getNotificationLog(sessionId);

    // セルフチェックアウト可能かどうかを判定
    const canCheckout = session.status === "open" && notificationLog !== null;
    const requiredWatchMs = course.requiredWatchMin * 60 * 1000;
    const now = new Date();
    const minEndTime = new Date(session.startTime.getTime() + requiredWatchMs);
    const hasRequiredTime = now.getTime() >= minEndTime.getTime();

    res.json({
      session: formatSession(session),
      course: {
        id: course.id,
        name: course.name,
        requiredWatchMin: course.requiredWatchMin,
      },
      notificationSent: notificationLog !== null,
      notificationSentAt: notificationLog ? toISOString(notificationLog.sentAt) : null,
      canCheckout,
      hasRequiredTime,
      minEndTime: toISOString(minEndTime),
    });
  } catch (error) {
    console.error("Error fetching self-checkout info:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to fetch self-checkout info" });
  }
});

/**
 * 受講者向け: セルフチェックアウト（OUT忘れ通知後の退室打刻）
 * POST /sessions/self-checkout
 *
 * 条件:
 * - 本人のセッションであること
 * - セッションがopen状態であること
 * - 初回通知が送信済みであること
 * - 入室からrequiredWatchMin経過していること
 * - 退室時刻が有効範囲内であること
 */
router.post("/sessions/self-checkout", requireUser, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const { sessionId, endTime: endTimeStr } = req.body;

    // バリデーション: sessionId必須
    if (!sessionId) {
      res.status(400).json({ error: "invalid_session_id", message: "sessionId is required" });
      return;
    }

    // バリデーション: endTime必須
    if (!endTimeStr) {
      res.status(400).json({ error: "invalid_end_time", message: "endTime is required" });
      return;
    }

    const endTime = new Date(endTimeStr);
    if (isNaN(endTime.getTime())) {
      res.status(400).json({ error: "invalid_end_time", message: "endTime must be a valid ISO 8601 date" });
      return;
    }

    // セッション存在確認
    const session = await ds.getSessionById(sessionId);
    if (!session) {
      res.status(404).json({ error: "session_not_found", message: "Session not found" });
      return;
    }

    // 本人確認
    if (session.userId !== req.user!.id) {
      res.status(403).json({ error: "not_owner", message: "Not your session" });
      return;
    }

    // セッション状態確認
    if (session.status !== "open") {
      res.status(400).json({ error: "session_closed", message: "Session is already closed" });
      return;
    }

    // 通知送信済み確認
    const notificationLog = await ds.getNotificationLog(sessionId);
    if (!notificationLog) {
      res.status(400).json({ error: "notification_not_sent", message: "No notification has been sent for this session" });
      return;
    }

    // 講座情報取得（requiredWatchMinを取得）
    const course = await ds.getCourseById(session.courseId);
    if (!course) {
      res.status(400).json({ error: "course_not_found", message: "Course not found" });
      return;
    }

    // 必要視聴時間経過確認
    const requiredWatchMs = course.requiredWatchMin * 60 * 1000;
    const minEndTime = new Date(session.startTime.getTime() + requiredWatchMs);

    if (endTime.getTime() < minEndTime.getTime()) {
      res.status(400).json({
        error: "not_enough_time",
        message: `End time must be at least ${course.requiredWatchMin} minutes after start time`,
      });
      return;
    }

    // 退室時刻の上限確認（現在時刻 + 5分のマージン）
    const now = new Date();
    const maxEndTime = new Date(now.getTime() + 5 * 60 * 1000);

    if (endTime.getTime() > maxEndTime.getTime()) {
      res.status(400).json({
        error: "invalid_end_time",
        message: "End time cannot be in the future",
      });
      return;
    }

    // 退室時刻の下限確認（startTime以降）
    if (endTime.getTime() < session.startTime.getTime()) {
      res.status(400).json({
        error: "invalid_end_time",
        message: "End time cannot be before start time",
      });
      return;
    }

    // セッション更新
    const durationSec = calculateDurationSec(session.startTime, endTime);
    const updated = await ds.updateSession(sessionId, {
      endTime,
      durationSec,
      status: "closed",
      lastHeartbeatAt: endTime,
    });

    res.json({ session: formatSession(updated!) });
  } catch (error) {
    console.error("Error in self-checkout:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to complete self-checkout" });
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

/**
 * 管理者向け: セッション削除（リセット）
 * DELETE /admin/sessions/:id
 *
 * ADR-0026: 管理者がセッションを削除して再入室を可能にする
 */
router.delete("/admin/sessions/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const id = req.params.id as string;

    const session = await ds.getSessionById(id);
    if (!session) {
      res.status(404).json({ error: "session_not_found", message: "Session not found" });
      return;
    }

    await ds.deleteSession(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting session:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to delete session" });
  }
});

export const sessionsRouter = router;
