import cors from "cors";
import express from "express";
import { initializeApp, getApps } from "firebase-admin/app";
import { authMiddleware } from "./middleware/auth.js";
import { tenantAwareAuthMiddleware } from "./middleware/tenant-auth.js";
import {
  tenantMiddleware,
  demoAuthMiddleware,
  demoReadOnlyMiddleware,
  dataSourceErrorHandler,
} from "./middleware/tenant.js";
import { createSharedRouter } from "./routes/shared/index.js";
import { tenantsRouter } from "./routes/tenants.js";
import { superAdminRouter } from "./routes/super-admin.js";
import { isValidEmail, isValidTimezone } from "./utils/validation.js";

// 旧デモルーター（後方互換性のため一時的に維持）
import { demoRouter } from "./routes/demo.js";

// Firebase Admin初期化（エミュレータ対応）
const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || "classroom-checkin-279";
if (getApps().length === 0) {
  initializeApp({ projectId });
  console.log(`Firebase Admin initialized with projectId: ${projectId}`);
}

const app = express();

// CORS設定: 本番環境ではCORS_ORIGINの設定を必須とする
const corsOrigins = process.env.CORS_ORIGIN?.split(",");
if (!corsOrigins && process.env.NODE_ENV === "production") {
  throw new Error("CORS_ORIGIN must be set in production");
}
app.use(cors({
  origin: corsOrigins ?? ["http://localhost:3000", "http://localhost:3001"],
  credentials: true,
}));
app.use(express.json());

// リクエストログミドルウェア（デバッグ用）
app.use((req, _res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// デモモード設定（環境変数で制御）
const DEMO_ENABLED = process.env.DEMO_ENABLED === "true";

// ヘルスチェック（認証不要）
// 複数パスで提供（/healthzはGCPで予約されている可能性があるため）
app.get(["/health", "/healthz", "/api/health"], (_req, res) => {
  res.json({ status: "ok" });
});

// ========================================
// 旧API（後方互換性のため維持）
// TODO: Phase 3完了後、Webを新エンドポイントに移行したら削除
// ========================================

// 旧APIルーター（本番用）
import { db } from "./storage/firestore.js";
import { requireAdmin, requireUser } from "./middleware/auth.js";

const legacyApiRouter = express.Router();

// Firestore TimestampをISO文字列に変換
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toISOString(timestamp: any): string | null {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === "function") {
    return timestamp.toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  if (typeof timestamp === "string") {
    return timestamp;
  }
  return null;
}

// セッションデータをシリアライズ
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeSession(id: string, data: any) {
  return {
    id,
    courseId: data.courseId,
    userId: data.userId,
    startTime: toISOString(data.startTime),
    endTime: toISOString(data.endTime),
    durationSec: data.durationSec ?? 0,
    source: data.source ?? "manual",
    confidence: data.confidence ?? null,
    status: data.status,
    lastHeartbeatAt: toISOString(data.lastHeartbeatAt),
  };
}

const notImplemented = (req: express.Request, res: express.Response) => {
  res.status(501).json({
    error: "not_implemented",
    path: req.path,
  });
};

// Auth
legacyApiRouter.get("/auth/google/start", notImplemented);
legacyApiRouter.get("/auth/google/callback", notImplemented);
legacyApiRouter.post("/auth/logout", notImplemented);
legacyApiRouter.get("/auth/me", requireUser, (req, res) => {
  res.json({ user: req.user });
});

// Courses (student view)
legacyApiRouter.get("/courses", requireUser, async (req, res) => {
  const coursesSnap = await db
    .collection("courses")
    .where("visible", "==", true)
    .where("enabled", "==", true)
    .get();

  if (coursesSnap.empty) {
    res.json({ courses: [] });
    return;
  }

  const courseIds = coursesSnap.docs.map((doc) => doc.id);

  const enrollmentSnaps = await Promise.all(
    courseIds.map((id) =>
      db
        .collection("enrollments")
        .where("userId", "==", req.user?.id)
        .where("courseId", "==", id)
        .limit(1)
        .get(),
    ),
  );

  const enrolledCourseIds = new Set(
    enrollmentSnaps
      .filter((snap) => !snap.empty)
      .map((snap) => snap.docs[0].data().courseId as string),
  );

  const filteredDocs =
    enrolledCourseIds.size > 0
      ? coursesSnap.docs.filter((doc) => enrolledCourseIds.has(doc.id))
      : coursesSnap.docs;

  const filteredCourseIds = new Set(filteredDocs.map((doc) => doc.id));

  type SessionSummary = {
    lastSessionAt: string | null;
    totalDurationSec: number;
    sessionCount: number;
    hasActiveSession: boolean;
  };
  const sessionSummaryMap = new Map<string, SessionSummary>();

  const courseIdArray = Array.from(filteredCourseIds);
  const BATCH_SIZE = 30;

  for (let i = 0; i < courseIdArray.length; i += BATCH_SIZE) {
    const batch = courseIdArray.slice(i, i + BATCH_SIZE);
    const sessionsSnap = await db
      .collection("sessions")
      .where("userId", "==", req.user!.id)
      .where("courseId", "in", batch)
      .get();

    for (const doc of sessionsSnap.docs) {
      const data = doc.data();
      const courseId = data.courseId as string;

      const summary = sessionSummaryMap.get(courseId) ?? {
        lastSessionAt: null,
        totalDurationSec: 0,
        sessionCount: 0,
        hasActiveSession: false,
      };

      summary.sessionCount++;

      const startTime = data.startTime?.toDate?.() ?? null;
      if (startTime) {
        const startTimeStr = startTime.toISOString();
        if (!summary.lastSessionAt || startTimeStr > summary.lastSessionAt) {
          summary.lastSessionAt = startTimeStr;
        }
      }

      if (data.status === "open") {
        summary.hasActiveSession = true;
      }

      if (data.status === "closed") {
        if (typeof data.durationSec === "number") {
          summary.totalDurationSec += data.durationSec;
        } else if (data.startTime && data.endTime) {
          const start = data.startTime.toDate?.() ?? new Date(data.startTime);
          const end = data.endTime.toDate?.() ?? new Date(data.endTime);
          summary.totalDurationSec += Math.floor(
            (end.getTime() - start.getTime()) / 1000,
          );
        }
      }

      sessionSummaryMap.set(courseId, summary);
    }
  }

  const courses = filteredDocs.map((doc) => {
    const data = doc.data();
    const summary = sessionSummaryMap.get(doc.id);
    return {
      id: doc.id,
      name: data.name,
      description: data.description ?? null,
      classroomUrl: data.classroomUrl,
      enabled: data.enabled,
      visible: data.visible,
      sessionSummary: summary ?? {
        lastSessionAt: null,
        totalDurationSec: 0,
        sessionCount: 0,
        hasActiveSession: false,
      },
    };
  });

  res.json({ courses });
});

// Sessions
legacyApiRouter.get("/sessions/active", requireUser, async (req, res) => {
  const courseId = req.query.courseId as string | undefined;

  const query = db
    .collection("sessions")
    .where("userId", "==", req.user?.id)
    .where("status", "==", "open");

  const sessionsSnap = courseId
    ? await query.where("courseId", "==", courseId).limit(1).get()
    : await query.get();

  if (sessionsSnap.empty) {
    res.json({ session: null });
    return;
  }

  const doc = sessionsSnap.docs[0];
  res.json({ session: serializeSession(doc.id, doc.data()) });
});

legacyApiRouter.post("/sessions/check-in", requireUser, async (req, res) => {
  const courseId = req.body?.courseId;
  if (!courseId) {
    res.status(400).json({ error: "course_id_required" });
    return;
  }

  const courseSnap = await db.collection("courses").doc(courseId).get();
  if (!courseSnap.exists || courseSnap.data()?.enabled !== true) {
    res.status(403).json({ error: "course_not_enabled" });
    return;
  }

  const openSnap = await db
    .collection("sessions")
    .where("courseId", "==", courseId)
    .where("userId", "==", req.user?.id)
    .where("status", "==", "open")
    .limit(1)
    .get();

  if (!openSnap.empty) {
    const doc = openSnap.docs[0];
    res.json({ session: serializeSession(doc.id, doc.data()), alreadyOpen: true });
    return;
  }

  const now = new Date();
  const sessionRef = await db.collection("sessions").add({
    courseId,
    userId: req.user?.id,
    startTime: now,
    endTime: null,
    durationSec: 0,
    source: "manual",
    confidence: null,
    status: "open",
    lastHeartbeatAt: now,
  });

  await db.collection("attendanceEvents").add({
    courseId,
    userId: req.user?.id,
    eventType: "IN",
    eventTime: now,
    source: "manual",
    sourceRef: sessionRef.id,
    payload: {},
  });

  const sessionSnap = await sessionRef.get();
  res.json({ session: serializeSession(sessionSnap.id, sessionSnap.data()) });
});

legacyApiRouter.post("/sessions/heartbeat", requireUser, async (req, res) => {
  const sessionId = req.body?.sessionId;
  if (!sessionId) {
    res.status(400).json({ error: "session_id_required" });
    return;
  }

  const sessionRef = db.collection("sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    res.status(404).json({ error: "session_not_found" });
    return;
  }

  const session = sessionSnap.data();
  if (session?.status !== "open") {
    res.status(409).json({ error: "session_not_open" });
    return;
  }

  await sessionRef.update({ lastHeartbeatAt: new Date() });
  res.json({ status: "ok" });
});

legacyApiRouter.post("/sessions/check-out", requireUser, async (req, res) => {
  const sessionId = req.body?.sessionId;
  if (!sessionId) {
    res.status(400).json({ error: "session_id_required" });
    return;
  }

  const sessionRef = db.collection("sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    res.status(404).json({ error: "session_not_found" });
    return;
  }

  const session = sessionSnap.data();
  if (session?.status !== "open") {
    res.status(409).json({ error: "session_not_open" });
    return;
  }

  const endTime = req.body?.at ? new Date(req.body.at) : new Date();
  const startTime = session?.startTime?.toDate
    ? session.startTime.toDate()
    : session?.startTime;
  const durationSec = startTime
    ? Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000))
    : 0;

  await sessionRef.update({
    endTime,
    durationSec,
    status: "closed",
  });

  await db.collection("attendanceEvents").add({
    courseId: session?.courseId,
    userId: req.user?.id,
    eventType: "OUT",
    eventTime: endTime,
    source: "manual",
    sourceRef: sessionRef.id,
    payload: {},
  });

  const updated = await sessionRef.get();
  res.json({ session: serializeSession(updated.id, updated.data()) });
});

// Admin: courses
legacyApiRouter.get("/admin/courses", requireAdmin, async (_req, res) => {
  const coursesSnap = await db.collection("courses").get();

  const courses = coursesSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      description: data.description ?? null,
      classroomUrl: data.classroomUrl,
      enabled: data.enabled ?? false,
      visible: data.visible ?? false,
      note: data.note ?? null,
      createdAt: toISOString(data.createdAt),
      updatedAt: toISOString(data.updatedAt),
    };
  });

  res.json({ courses });
});

legacyApiRouter.post("/admin/courses", requireAdmin, async (req, res) => {
  const name = req.body?.name;
  const classroomUrl = req.body?.classroomUrl;
  const description = req.body?.description ?? null;
  const enabled = req.body?.enabled ?? true;
  const visible = req.body?.visible ?? true;
  const note = req.body?.note ?? null;
  const normalizedVisible = enabled ? visible : false;

  if (!name) {
    res.status(400).json({ error: "name_required" });
    return;
  }

  const now = new Date();
  const ref = await db.collection("courses").add({
    name,
    description,
    classroomUrl: classroomUrl ?? null,
    enabled,
    visible: normalizedVisible,
    note,
    createdAt: now,
    updatedAt: now,
  });

  res.json({
    id: ref.id,
    name,
    description,
    classroomUrl,
    enabled,
    visible: normalizedVisible,
    note,
  });
});

legacyApiRouter.patch("/admin/courses/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const updates: Record<string, unknown> = {};

  if (typeof req.body?.name === "string") updates.name = req.body.name;
  if (typeof req.body?.description === "string") updates.description = req.body.description;
  if (typeof req.body?.classroomUrl === "string") updates.classroomUrl = req.body.classroomUrl;
  if (typeof req.body?.enabled === "boolean") updates.enabled = req.body.enabled;
  if (typeof req.body?.visible === "boolean") updates.visible = req.body.visible;
  if (typeof req.body?.note === "string") updates.note = req.body.note;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "no_updates" });
    return;
  }

  const ref = db.collection("courses").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: "course_not_found" });
    return;
  }

  const currentData = snap.data() ?? {};
  const enabled =
    typeof updates.enabled === "boolean" ? updates.enabled : currentData.enabled;
  const visible =
    typeof updates.visible === "boolean" ? updates.visible : currentData.visible;
  const normalizedVisible = enabled ? visible : false;

  updates.visible = normalizedVisible;
  updates.updatedAt = new Date();

  await ref.update(updates);
  res.json({ id, ...currentData, ...updates });
});

legacyApiRouter.delete("/admin/courses/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const ref = db.collection("courses").doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    res.status(404).json({ error: "course_not_found" });
    return;
  }

  const sessionsSnap = await db
    .collection("sessions")
    .where("courseId", "==", id)
    .limit(1)
    .get();

  if (!sessionsSnap.empty) {
    res.status(409).json({ error: "course_has_sessions" });
    return;
  }

  await ref.delete();
  res.json({ deleted: true, id });
});

// Admin: users
legacyApiRouter.get("/admin/users", requireAdmin, async (_req, res) => {
  const usersSnap = await db.collection("users").get();

  const users = usersSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      email: data.email,
      name: data.name ?? null,
      role: data.role ?? "student",
      createdAt: toISOString(data.createdAt),
      updatedAt: toISOString(data.updatedAt),
    };
  });

  res.json({ users });
});

legacyApiRouter.post("/admin/users", requireAdmin, async (req, res) => {
  const email = req.body?.email;
  const name = req.body?.name ?? null;
  const role = req.body?.role ?? "student";

  if (!email) {
    res.status(400).json({ error: "email_required" });
    return;
  }

  const existingSnap = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    res.status(409).json({ error: "email_already_exists" });
    return;
  }

  const now = new Date();
  const ref = await db.collection("users").add({
    email,
    name,
    role,
    createdAt: now,
    updatedAt: now,
  });

  res.json({
    id: ref.id,
    email,
    name,
    role,
    createdAt: now,
    updatedAt: now,
  });
});

legacyApiRouter.get("/admin/users/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const ref = db.collection("users").doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }

  const data = snap.data() ?? {};
  res.json({
    id: snap.id,
    email: data.email,
    name: data.name ?? null,
    role: data.role ?? "student",
    createdAt: toISOString(data.createdAt),
    updatedAt: toISOString(data.updatedAt),
  });
});

legacyApiRouter.patch("/admin/users/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const updates: Record<string, unknown> = {};

  if (typeof req.body?.email === "string") updates.email = req.body.email;
  if (typeof req.body?.name === "string") updates.name = req.body.name;
  if (typeof req.body?.role === "string") updates.role = req.body.role;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "no_updates" });
    return;
  }

  const ref = db.collection("users").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }

  if (updates.email) {
    const existingSnap = await db
      .collection("users")
      .where("email", "==", updates.email)
      .limit(1)
      .get();

    if (!existingSnap.empty && existingSnap.docs[0].id !== id) {
      res.status(409).json({ error: "email_already_exists" });
      return;
    }
  }

  updates.updatedAt = new Date();
  await ref.update(updates);

  const currentData = snap.data() ?? {};
  res.json({ id, ...currentData, ...updates });
});

legacyApiRouter.delete("/admin/users/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const ref = db.collection("users").doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }

  const enrollmentsSnap = await db
    .collection("enrollments")
    .where("userId", "==", id)
    .get();

  const batch = db.batch();
  enrollmentsSnap.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(ref);
  await batch.commit();

  res.json({ deleted: true, id });
});

// Admin: enrollments
legacyApiRouter.get("/admin/enrollments", requireAdmin, async (req, res) => {
  const courseId = req.query.courseId as string | undefined;
  const userId = req.query.userId as string | undefined;

  let query: FirebaseFirestore.Query = db.collection("enrollments");

  if (courseId) {
    query = query.where("courseId", "==", courseId);
  }
  if (userId) {
    query = query.where("userId", "==", userId);
  }

  const enrollmentsSnap = await query.get();

  const enrollments = enrollmentsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      courseId: data.courseId,
      userId: data.userId,
      role: data.role ?? "student",
      startAt: toISOString(data.startAt),
      endAt: toISOString(data.endAt),
      createdAt: toISOString(data.createdAt),
    };
  });

  res.json({ enrollments });
});

legacyApiRouter.post("/admin/enrollments", requireAdmin, async (req, res) => {
  const courseId = req.body?.courseId;
  const userId = req.body?.userId;
  const role = req.body?.role ?? "student";
  const startAt = req.body?.startAt ? new Date(req.body.startAt) : new Date();
  const endAt = req.body?.endAt ? new Date(req.body.endAt) : null;

  if (!courseId || !userId) {
    res.status(400).json({ error: "course_id_and_user_id_required" });
    return;
  }

  const courseSnap = await db.collection("courses").doc(courseId).get();
  if (!courseSnap.exists) {
    res.status(404).json({ error: "course_not_found" });
    return;
  }

  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }

  const existingSnap = await db
    .collection("enrollments")
    .where("courseId", "==", courseId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    res.status(409).json({ error: "enrollment_already_exists" });
    return;
  }

  const now = new Date();
  const ref = await db.collection("enrollments").add({
    courseId,
    userId,
    role,
    startAt,
    endAt,
    createdAt: now,
  });

  res.json({
    id: ref.id,
    courseId,
    userId,
    role,
    startAt,
    endAt,
    createdAt: now,
  });
});

legacyApiRouter.patch("/admin/enrollments/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const updates: Record<string, unknown> = {};

  if (typeof req.body?.role === "string") updates.role = req.body.role;
  if (req.body?.startAt !== undefined) {
    updates.startAt = req.body.startAt ? new Date(req.body.startAt) : null;
  }
  if (req.body?.endAt !== undefined) {
    updates.endAt = req.body.endAt ? new Date(req.body.endAt) : null;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "no_updates" });
    return;
  }

  const ref = db.collection("enrollments").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: "enrollment_not_found" });
    return;
  }

  await ref.update(updates);

  const currentData = snap.data() ?? {};
  res.json({ id, ...currentData, ...updates });
});

legacyApiRouter.delete("/admin/enrollments/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const ref = db.collection("enrollments").doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    res.status(404).json({ error: "enrollment_not_found" });
    return;
  }

  await ref.delete();
  res.json({ deleted: true, id });
});

// Admin: sessions
legacyApiRouter.get("/admin/sessions", requireAdmin, async (req, res) => {
  const courseId = req.query.courseId as string | undefined;
  const userId = req.query.userId as string | undefined;
  const status = req.query.status as string | undefined;

  let query: FirebaseFirestore.Query = db.collection("sessions");

  if (courseId) {
    query = query.where("courseId", "==", courseId);
  }
  if (userId) {
    query = query.where("userId", "==", userId);
  }
  if (status) {
    query = query.where("status", "==", status);
  }

  const sessionsSnap = await query.orderBy("startTime", "desc").limit(100).get();

  const sessions = sessionsSnap.docs.map((doc) =>
    serializeSession(doc.id, doc.data())
  );

  res.json({ sessions });
});

legacyApiRouter.post("/admin/sessions/:id/close", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const closedAt = req.body?.closedAt ? new Date(req.body.closedAt) : new Date();
  const reason = req.body?.reason ?? "admin_close";

  const sessionRef = db.collection("sessions").doc(id);
  const sessionSnap = await sessionRef.get();

  if (!sessionSnap.exists) {
    res.status(404).json({ error: "session_not_found" });
    return;
  }

  const session = sessionSnap.data();
  if (session?.status !== "open") {
    res.status(409).json({ error: "session_not_open" });
    return;
  }

  const startTime = session?.startTime?.toDate
    ? session.startTime.toDate()
    : session?.startTime;
  const durationSec = startTime
    ? Math.max(0, Math.floor((closedAt.getTime() - startTime.getTime()) / 1000))
    : 0;

  await sessionRef.update({
    endTime: closedAt,
    durationSec,
    status: "adjusted",
  });

  await db.collection("attendanceEvents").add({
    courseId: session?.courseId,
    userId: session?.userId,
    eventType: "ADJUST",
    eventTime: closedAt,
    source: "manual",
    sourceRef: id,
    payload: { reason, closedBy: "admin" },
  });

  const updated = await sessionRef.get();
  res.json({ session: serializeSession(updated.id, updated.data()) });
});

// Admin: notification policies
legacyApiRouter.get("/admin/notification-policies", requireAdmin, async (req, res) => {
  const scope = req.query.scope as string | undefined;
  const courseId = req.query.courseId as string | undefined;
  const userId = req.query.userId as string | undefined;

  let query: FirebaseFirestore.Query = db.collection("notificationPolicies");

  if (scope) {
    query = query.where("scope", "==", scope);
  }
  if (courseId) {
    query = query.where("courseId", "==", courseId);
  }
  if (userId) {
    query = query.where("userId", "==", userId);
  }

  const policiesSnap = await query.get();

  const policies = policiesSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      scope: data.scope,
      courseId: data.courseId ?? null,
      userId: data.userId ?? null,
      firstNotifyAfterMin: data.firstNotifyAfterMin ?? 60,
      repeatIntervalHours: data.repeatIntervalHours ?? 24,
      maxRepeatDays: data.maxRepeatDays ?? 7,
      active: data.active ?? true,
      createdAt: toISOString(data.createdAt),
      updatedAt: toISOString(data.updatedAt),
    };
  });

  res.json({ policies });
});

legacyApiRouter.post("/admin/notification-policies", requireAdmin, async (req, res) => {
  const scope = req.body?.scope as "global" | "course" | "user";
  const courseId = req.body?.courseId ?? null;
  const userId = req.body?.userId ?? null;
  const firstNotifyAfterMin = req.body?.firstNotifyAfterMin ?? 60;
  const repeatIntervalHours = req.body?.repeatIntervalHours ?? 24;
  const maxRepeatDays = req.body?.maxRepeatDays ?? 7;
  const active = req.body?.active ?? true;

  if (!scope || !["global", "course", "user"].includes(scope)) {
    res.status(400).json({ error: "valid_scope_required" });
    return;
  }

  if (scope === "course" && !courseId) {
    res.status(400).json({ error: "course_id_required_for_course_scope" });
    return;
  }

  if (scope === "user" && !userId) {
    res.status(400).json({ error: "user_id_required_for_user_scope" });
    return;
  }

  if (scope === "course" && courseId) {
    const courseSnap = await db.collection("courses").doc(courseId).get();
    if (!courseSnap.exists) {
      res.status(404).json({ error: "course_not_found" });
      return;
    }
  }

  if (scope === "user" && userId) {
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }
  }

  let duplicateQuery: FirebaseFirestore.Query = db
    .collection("notificationPolicies")
    .where("scope", "==", scope);

  if (scope === "course") {
    duplicateQuery = duplicateQuery.where("courseId", "==", courseId);
  } else if (scope === "user") {
    duplicateQuery = duplicateQuery.where("userId", "==", userId);
  }

  const duplicateSnap = await duplicateQuery.limit(1).get();
  if (!duplicateSnap.empty) {
    res.status(409).json({ error: "policy_already_exists" });
    return;
  }

  const now = new Date();
  const ref = await db.collection("notificationPolicies").add({
    scope,
    courseId: scope === "course" ? courseId : null,
    userId: scope === "user" ? userId : null,
    firstNotifyAfterMin,
    repeatIntervalHours,
    maxRepeatDays,
    active,
    createdAt: now,
    updatedAt: now,
  });

  res.json({
    id: ref.id,
    scope,
    courseId: scope === "course" ? courseId : null,
    userId: scope === "user" ? userId : null,
    firstNotifyAfterMin,
    repeatIntervalHours,
    maxRepeatDays,
    active,
    createdAt: now,
    updatedAt: now,
  });
});

legacyApiRouter.patch("/admin/notification-policies/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const updates: Record<string, unknown> = {};

  if (typeof req.body?.firstNotifyAfterMin === "number") {
    updates.firstNotifyAfterMin = req.body.firstNotifyAfterMin;
  }
  if (typeof req.body?.repeatIntervalHours === "number") {
    updates.repeatIntervalHours = req.body.repeatIntervalHours;
  }
  if (typeof req.body?.maxRepeatDays === "number") {
    updates.maxRepeatDays = req.body.maxRepeatDays;
  }
  if (typeof req.body?.active === "boolean") {
    updates.active = req.body.active;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "no_updates" });
    return;
  }

  const ref = db.collection("notificationPolicies").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: "policy_not_found" });
    return;
  }

  updates.updatedAt = new Date();
  await ref.update(updates);

  const currentData = snap.data() ?? {};
  res.json({ id, ...currentData, ...updates });
});

legacyApiRouter.delete("/admin/notification-policies/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const ref = db.collection("notificationPolicies").doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    res.status(404).json({ error: "policy_not_found" });
    return;
  }

  await ref.delete();
  res.json({ deleted: true, id });
});

// Admin: user settings
legacyApiRouter.get("/admin/users/:id/settings", requireAdmin, async (req, res) => {
  const userId = req.params.id as string;

  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }

  const settingsSnap = await db
    .collection("userSettings")
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (settingsSnap.empty) {
    res.json({
      userId,
      notifyEnabled: true,
      notifyEmail: userSnap.data()?.email ?? null,
      timezone: "Asia/Tokyo",
    });
    return;
  }

  const doc = settingsSnap.docs[0];
  const data = doc.data();
  res.json({
    id: doc.id,
    userId: data.userId,
    notifyEnabled: data.notifyEnabled ?? true,
    notifyEmail: data.notifyEmail ?? null,
    timezone: data.timezone ?? "Asia/Tokyo",
    updatedAt: toISOString(data.updatedAt),
  });
});

legacyApiRouter.patch("/admin/users/:id/settings", requireAdmin, async (req, res) => {
  const userId = req.params.id as string;

  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }

  const updates: Record<string, unknown> = {};

  if (typeof req.body?.notifyEnabled === "boolean") {
    updates.notifyEnabled = req.body.notifyEnabled;
  }
  if (typeof req.body?.notifyEmail === "string") {
    if (!isValidEmail(req.body.notifyEmail)) {
      res.status(400).json({ error: "invalid_email_format" });
      return;
    }
    updates.notifyEmail = req.body.notifyEmail;
  }
  if (typeof req.body?.timezone === "string") {
    if (!isValidTimezone(req.body.timezone)) {
      res.status(400).json({ error: "invalid_timezone" });
      return;
    }
    updates.timezone = req.body.timezone;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "no_updates" });
    return;
  }

  const settingsSnap = await db
    .collection("userSettings")
    .where("userId", "==", userId)
    .limit(1)
    .get();

  const now = new Date();
  updates.updatedAt = now;

  if (settingsSnap.empty) {
    const ref = await db.collection("userSettings").add({
      userId,
      notifyEnabled: updates.notifyEnabled ?? true,
      notifyEmail: updates.notifyEmail ?? userSnap.data()?.email ?? null,
      timezone: updates.timezone ?? "Asia/Tokyo",
      createdAt: now,
      updatedAt: now,
    });

    const newDoc = await ref.get();
    res.json({ id: newDoc.id, ...newDoc.data() });
  } else {
    const doc = settingsSnap.docs[0];
    await doc.ref.update(updates);

    const currentData = doc.data();
    res.json({ id: doc.id, ...currentData, ...updates });
  }
});

// Admin: allowed emails
legacyApiRouter.get("/admin/allowed-emails", requireAdmin, async (_req, res) => {
  const allowedSnap = await db.collection("allowedEmails").orderBy("createdAt", "desc").get();

  const allowedEmails = allowedSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      email: data.email,
      note: data.note ?? null,
      createdAt: toISOString(data.createdAt),
    };
  });

  res.json({ allowedEmails });
});

legacyApiRouter.post("/admin/allowed-emails", requireAdmin, async (req, res) => {
  const email = req.body?.email;
  const note = req.body?.note ?? null;

  if (!email) {
    res.status(400).json({ error: "email_required" });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "invalid_email_format" });
    return;
  }

  const existingSnap = await db
    .collection("allowedEmails")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    res.status(409).json({ error: "email_already_allowed" });
    return;
  }

  const now = new Date();
  const ref = await db.collection("allowedEmails").add({
    email,
    note,
    createdAt: now,
  });

  res.json({
    id: ref.id,
    email,
    note,
    createdAt: now,
  });
});

legacyApiRouter.delete("/admin/allowed-emails/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const ref = db.collection("allowedEmails").doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    res.status(404).json({ error: "allowed_email_not_found" });
    return;
  }

  await ref.delete();
  res.json({ deleted: true, id });
});

// ========================================
// ルーターのマウント
// ========================================

// 旧デモモード（後方互換性のため維持）
if (DEMO_ENABLED) {
  app.use("/api/v1/demo", demoRouter);
  console.log("Demo mode enabled (mock data, read-only)");
}

// 旧API（後方互換性のため維持）
app.use("/api/v1", authMiddleware, legacyApiRouter);

// ========================================
// 新テナントベースAPI
// ========================================

// テナント登録API（認証のみ、テナントコンテキスト不要）
// POST /api/v2/tenants - 新規テナント作成
// GET /api/v2/tenants/mine - 自分のテナント一覧
app.use("/api/v2/tenants", tenantsRouter);

// スーパー管理者API（SUPER_ADMIN_EMAILSで認可）
// GET /api/v2/super/tenants - 全テナント一覧
// GET /api/v2/super/tenants/:id - テナント詳細
// PATCH /api/v2/super/tenants/:id - テナント更新
app.use("/api/v2/super", superAdminRouter);

// URL: /api/v2/:tenant/*
// - /api/v2/demo/* → デモモード（読み取り専用、モックデータ）
// - /api/v2/{tenantId}/* → 本番モード（Firestore）
app.use(
  "/api/v2/:tenant",
  tenantMiddleware,            // テナントコンテキスト設定
  demoAuthMiddleware,          // デモ用固定ユーザー設定
  tenantAwareAuthMiddleware,   // テナント対応認証（DataSource使用）
  demoReadOnlyMiddleware,      // デモ用読み取り専用制限
  createSharedRouter()         // 共通ルーター
);

// DataSourceエラーハンドラ
app.use(dataSourceErrorHandler);

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`API service listening on :${port}`);
  console.log("Routes:");
  console.log("  - /health, /healthz, /api/health (health check)");
  console.log("  - /api/v1/* (legacy API)");
  if (DEMO_ENABLED) {
    console.log("  - /api/v1/demo/* (legacy demo)");
  }
  console.log("  - /api/v2/tenants (tenant registration)");
  console.log("  - /api/v2/super/* (super admin API)");
  console.log("  - /api/v2/:tenant/* (new tenant-based API)");
});
