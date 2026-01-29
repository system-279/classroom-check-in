/**
 * 統合テスト用ヘルパー
 * ルーター作成関数（ミドルウェアをスキップ）
 */

import { Router, Request, Response } from "express";
import { toISOString } from "../../../utils/date.js";

/**
 * 滞在時間（秒）を計算
 */
function calculateDurationSec(startTime: Date, endTime: Date): number {
  const durationMs = endTime.getTime() - startTime.getTime();
  return Math.max(0, Math.floor(durationMs / 1000));
}

/**
 * セッションレスポンスの共通フォーマット
 */
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
 * セッションルーターを作成（認証ミドルウェアなし）
 * 統合テスト用: req.user と req.dataSource は事前にセット済みを想定
 */
export function createSessionsRouter(): Router {
  const router = Router();

  // GET /sessions/active
  router.get("/sessions/active", async (req: Request, res: Response) => {
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
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /sessions/check-in
  router.post("/sessions/check-in", async (req: Request, res: Response) => {
    try {
      const ds = req.dataSource!;
      const { courseId } = req.body;

      if (!courseId) {
        res.status(400).json({ error: "invalid_course_id" });
        return;
      }

      const course = await ds.getCourseById(courseId);
      if (!course || !course.enabled || !course.visible) {
        res.status(404).json({ error: "course_not_found" });
        return;
      }

      const enrollments = await ds.getEnrollments({
        courseId,
        userId: req.user!.id,
      });
      if (enrollments.length === 0) {
        res.status(403).json({ error: "not_enrolled" });
        return;
      }

      // ADR-0023: 同時セッション禁止
      const existingSession = await ds.getActiveSession(req.user!.id);
      if (existingSession && existingSession.courseId !== courseId) {
        res.status(409).json({
          error: "session_conflict",
          message: "You already have an active session in another course",
          existingSession: formatSession(existingSession),
        });
        return;
      }

      const now = new Date();
      const sessionData = {
        courseId,
        userId: req.user!.id,
        startTime: now,
        endTime: null,
        durationSec: 0,
        source: "manual",
        confidence: null,
        status: "open" as const,
        lastHeartbeatAt: now,
      };

      const result = await ds.checkInOrGetExisting(
        req.user!.id,
        courseId,
        sessionData
      );

      res.status(result.isExisting ? 200 : 201).json({
        session: formatSession(result.session),
        isExisting: result.isExisting,
      });
    } catch (error) {
      console.error("Error during check-in:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /sessions/:id/heartbeat
  router.post("/sessions/:id/heartbeat", async (req: Request, res: Response) => {
    try {
      const ds = req.dataSource!;
      const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const session = await ds.getSessionById(sessionId);

      if (!session) {
        res.status(404).json({ error: "session_not_found" });
        return;
      }

      if (session.userId !== req.user!.id) {
        res.status(403).json({ error: "forbidden" });
        return;
      }

      if (session.status !== "open") {
        res.status(400).json({ error: "session_not_open" });
        return;
      }

      const updated = await ds.updateSession(session.id, {
        lastHeartbeatAt: new Date(),
      });

      res.json({ session: formatSession(updated!) });
    } catch (error) {
      console.error("Error during heartbeat:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST /sessions/:id/check-out
  router.post("/sessions/:id/check-out", async (req: Request, res: Response) => {
    try {
      const ds = req.dataSource!;
      const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const session = await ds.getSessionById(sessionId);

      if (!session) {
        res.status(404).json({ error: "session_not_found" });
        return;
      }

      if (session.userId !== req.user!.id) {
        res.status(403).json({ error: "forbidden" });
        return;
      }

      if (session.status === "closed") {
        res.status(400).json({ error: "session_already_closed" });
        return;
      }

      const endTime = new Date();
      const durationSec = calculateDurationSec(session.startTime, endTime);

      const updated = await ds.updateSession(session.id, {
        status: "closed",
        endTime,
        durationSec,
      });

      res.json({ session: formatSession(updated!) });
    } catch (error) {
      console.error("Error during check-out:", error);
      res.status(500).json({ error: "internal_error" });
    }
  });

  return router;
}
