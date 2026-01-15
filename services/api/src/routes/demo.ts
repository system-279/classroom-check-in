/**
 * デモモード専用ルーター
 * Firestoreを使用せず、インメモリのモックデータを返す
 */
import express from "express";
import {
  demoCourses,
  demoUsers,
  demoEnrollments,
  demoSessions,
  demoNotificationPolicies,
  demoAllowedEmails,
  toISOStringOrNull,
} from "../demo-data.js";

export const demoRouter = express.Router();

// デモ用固定ユーザー設定ミドルウェア
demoRouter.use((req, _res, next) => {
  req.user = {
    id: "demo-admin",
    role: "admin",
    email: "admin@demo.example.com",
  };
  next();
});

// 読み取り専用ミドルウェア（POST/PATCH/DELETE/PUTをブロック）
demoRouter.use((req, res, next) => {
  const readOnlyMethods = ["POST", "PATCH", "DELETE", "PUT"];
  if (readOnlyMethods.includes(req.method)) {
    res.status(403).json({
      error: "demo_read_only",
      message: "デモモードでは変更操作はできません",
    });
    return;
  }
  next();
});

// Auth
demoRouter.get("/auth/me", (req, res) => {
  res.json({ user: req.user });
});

// Courses (student view)
demoRouter.get("/courses", (req, res) => {
  const visibleCourses = demoCourses
    .filter((c) => c.enabled && c.visible)
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      classroomUrl: c.classroomUrl,
      enabled: c.enabled,
      visible: c.visible,
      sessionSummary: {
        lastSessionAt: null,
        totalDurationSec: 0,
        sessionCount: 0,
        hasActiveSession: false,
      },
    }));
  res.json({ courses: visibleCourses });
});

// Sessions
demoRouter.get("/sessions/active", (req, res) => {
  const courseId = req.query.courseId as string | undefined;
  const openSession = demoSessions.find(
    (s) => s.status === "open" && (!courseId || s.courseId === courseId)
  );

  if (!openSession) {
    res.json({ session: null });
    return;
  }

  res.json({
    session: {
      ...openSession,
      startTime: toISOStringOrNull(openSession.startTime),
      endTime: toISOStringOrNull(openSession.endTime),
      lastHeartbeatAt: toISOStringOrNull(openSession.lastHeartbeatAt),
    },
  });
});

// Admin: courses
demoRouter.get("/admin/courses", (_req, res) => {
  const courses = demoCourses.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    classroomUrl: c.classroomUrl,
    enabled: c.enabled,
    visible: c.visible,
    note: c.note,
    createdAt: toISOStringOrNull(c.createdAt),
    updatedAt: toISOStringOrNull(c.updatedAt),
  }));
  res.json({ courses });
});

// Admin: users
demoRouter.get("/admin/users", (_req, res) => {
  const users = demoUsers.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: toISOStringOrNull(u.createdAt),
    updatedAt: toISOStringOrNull(u.updatedAt),
  }));
  res.json({ users });
});

demoRouter.get("/admin/users/:id", (req, res) => {
  const user = demoUsers.find((u) => u.id === req.params.id);
  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: toISOStringOrNull(user.createdAt),
    updatedAt: toISOStringOrNull(user.updatedAt),
  });
});

demoRouter.get("/admin/users/:id/settings", (req, res) => {
  const user = demoUsers.find((u) => u.id === req.params.id);
  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }
  res.json({
    userId: user.id,
    notifyEnabled: true,
    notifyEmail: user.email,
    timezone: "Asia/Tokyo",
  });
});

// Admin: enrollments
demoRouter.get("/admin/enrollments", (req, res) => {
  const courseId = req.query.courseId as string | undefined;
  const userId = req.query.userId as string | undefined;

  let filtered = demoEnrollments;
  if (courseId) {
    filtered = filtered.filter((e) => e.courseId === courseId);
  }
  if (userId) {
    filtered = filtered.filter((e) => e.userId === userId);
  }

  const enrollments = filtered.map((e) => ({
    id: e.id,
    courseId: e.courseId,
    userId: e.userId,
    role: e.role,
    startAt: toISOStringOrNull(e.startAt),
    endAt: toISOStringOrNull(e.endAt),
    createdAt: toISOStringOrNull(e.createdAt),
  }));
  res.json({ enrollments });
});

// Admin: sessions
demoRouter.get("/admin/sessions", (req, res) => {
  const courseId = req.query.courseId as string | undefined;
  const userId = req.query.userId as string | undefined;
  const status = req.query.status as string | undefined;

  let filtered = demoSessions;
  if (courseId) {
    filtered = filtered.filter((s) => s.courseId === courseId);
  }
  if (userId) {
    filtered = filtered.filter((s) => s.userId === userId);
  }
  if (status) {
    filtered = filtered.filter((s) => s.status === status);
  }

  const sessions = filtered.map((s) => ({
    id: s.id,
    courseId: s.courseId,
    userId: s.userId,
    startTime: toISOStringOrNull(s.startTime),
    endTime: toISOStringOrNull(s.endTime),
    durationSec: s.durationSec,
    source: s.source,
    confidence: s.confidence,
    status: s.status,
    lastHeartbeatAt: toISOStringOrNull(s.lastHeartbeatAt),
  }));
  res.json({ sessions });
});

// Admin: notification policies
demoRouter.get("/admin/notification-policies", (req, res) => {
  const scope = req.query.scope as string | undefined;

  let filtered = demoNotificationPolicies;
  if (scope) {
    filtered = filtered.filter((p) => p.scope === scope);
  }

  const policies = filtered.map((p) => ({
    id: p.id,
    scope: p.scope,
    courseId: p.courseId,
    userId: p.userId,
    firstNotifyAfterMin: p.firstNotifyAfterMin,
    repeatIntervalHours: p.repeatIntervalHours,
    maxRepeatDays: p.maxRepeatDays,
    active: p.active,
    createdAt: toISOStringOrNull(p.createdAt),
    updatedAt: toISOStringOrNull(p.updatedAt),
  }));
  res.json({ policies });
});

// Admin: allowed emails
demoRouter.get("/admin/allowed-emails", (_req, res) => {
  const allowedEmails = demoAllowedEmails.map((a) => ({
    id: a.id,
    email: a.email,
    note: a.note,
    createdAt: toISOStringOrNull(a.createdAt),
  }));
  res.json({ allowedEmails });
});
