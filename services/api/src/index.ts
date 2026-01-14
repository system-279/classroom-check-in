import cors from "cors";
import express from "express";
import { authMiddleware, requireAdmin, requireUser } from "./middleware/auth.js";
import { db } from "./storage/firestore.js";

// バリデーションヘルパー
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

function isValidTimezone(tz: string): boolean {
  return VALID_TIMEZONES.has(tz);
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
app.use(authMiddleware);

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

const notImplemented = (req: express.Request, res: express.Response) => {
  res.status(501).json({
    error: "not_implemented",
    path: req.path,
  });
};

// Auth (OAuth is not wired yet)
app.get("/api/v1/auth/google/start", notImplemented);
app.get("/api/v1/auth/google/callback", notImplemented);
app.post("/api/v1/auth/logout", notImplemented);
app.get("/api/v1/auth/me", requireUser, (req, res) => {
  res.json({ user: req.user });
});

// Courses (student view)
app.get("/api/v1/courses", requireUser, async (req, res) => {
  // enabled=true かつ visible=true の講座を取得
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

  // ユーザーが登録されている講座を確認
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

  // 登録がある場合は登録講座のみ、なければ全講座を返す
  const filteredDocs =
    enrolledCourseIds.size > 0
      ? coursesSnap.docs.filter((doc) => enrolledCourseIds.has(doc.id))
      : coursesSnap.docs;

  const courses = filteredDocs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      description: data.description ?? null,
      classroomUrl: data.classroomUrl,
      enabled: data.enabled,
      visible: data.visible,
    };
  });

  res.json({ courses });
});

// Sessions

// アクティブセッション確認（P1修正: check-in APIの誤用を防ぐ）
app.get("/api/v1/sessions/active", requireUser, async (req, res) => {
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
  res.json({ session: { id: doc.id, ...doc.data() } });
});

app.post("/api/v1/sessions/check-in", requireUser, async (req, res) => {
  const courseId = req.body?.courseId;
  if (!courseId) {
    res.status(400).json({ error: "course_id_required" });
    return;
  }

  // 講座が存在し、enabled=true かを確認
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
    res.json({ session: { id: doc.id, ...doc.data() }, alreadyOpen: true });
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
  res.json({ session: { id: sessionSnap.id, ...sessionSnap.data() } });
});

app.post("/api/v1/sessions/heartbeat", requireUser, async (req, res) => {
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

app.post("/api/v1/sessions/check-out", requireUser, async (req, res) => {
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
  res.json({ session: { id: updated.id, ...updated.data() } });
});

// Admin: courses
app.get("/api/v1/admin/courses", requireAdmin, async (_req, res) => {
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
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  });

  res.json({ courses });
});

app.post("/api/v1/admin/courses", requireAdmin, async (req, res) => {
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

app.patch("/api/v1/admin/courses/:id", requireAdmin, async (req, res) => {
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

app.delete("/api/v1/admin/courses/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const ref = db.collection("courses").doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    res.status(404).json({ error: "course_not_found" });
    return;
  }

  // 関連するセッションがある場合は削除を拒否
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
app.get("/api/v1/admin/users", requireAdmin, async (_req, res) => {
  const usersSnap = await db.collection("users").get();

  const users = usersSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      email: data.email,
      name: data.name ?? null,
      role: data.role ?? "student",
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  });

  res.json({ users });
});

app.post("/api/v1/admin/users", requireAdmin, async (req, res) => {
  const email = req.body?.email;
  const name = req.body?.name ?? null;
  const role = req.body?.role ?? "student";

  if (!email) {
    res.status(400).json({ error: "email_required" });
    return;
  }

  // メールアドレスの重複チェック
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

app.get("/api/v1/admin/users/:id", requireAdmin, async (req, res) => {
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
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  });
});

app.patch("/api/v1/admin/users/:id", requireAdmin, async (req, res) => {
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

  // メールアドレス変更時の重複チェック
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

app.delete("/api/v1/admin/users/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const ref = db.collection("users").doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }

  // 関連する受講登録を削除
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
app.get("/api/v1/admin/enrollments", requireAdmin, async (req, res) => {
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
      startAt: data.startAt,
      endAt: data.endAt ?? null,
      createdAt: data.createdAt,
    };
  });

  res.json({ enrollments });
});

app.post("/api/v1/admin/enrollments", requireAdmin, async (req, res) => {
  const courseId = req.body?.courseId;
  const userId = req.body?.userId;
  const role = req.body?.role ?? "student";
  const startAt = req.body?.startAt ? new Date(req.body.startAt) : new Date();
  const endAt = req.body?.endAt ? new Date(req.body.endAt) : null;

  if (!courseId || !userId) {
    res.status(400).json({ error: "course_id_and_user_id_required" });
    return;
  }

  // 講座の存在確認
  const courseSnap = await db.collection("courses").doc(courseId).get();
  if (!courseSnap.exists) {
    res.status(404).json({ error: "course_not_found" });
    return;
  }

  // ユーザーの存在確認
  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }

  // 重複登録チェック
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

app.patch("/api/v1/admin/enrollments/:id", requireAdmin, async (req, res) => {
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

app.delete("/api/v1/admin/enrollments/:id", requireAdmin, async (req, res) => {
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
app.get("/api/v1/admin/sessions", requireAdmin, async (req, res) => {
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

  const sessions = sessionsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      courseId: data.courseId,
      userId: data.userId,
      startTime: data.startTime,
      endTime: data.endTime ?? null,
      durationSec: data.durationSec ?? 0,
      source: data.source ?? "manual",
      status: data.status,
      lastHeartbeatAt: data.lastHeartbeatAt ?? null,
    };
  });

  res.json({ sessions });
});

app.post("/api/v1/admin/sessions/:id/close", requireAdmin, async (req, res) => {
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

  // 補正イベントを記録
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
  res.json({ session: { id: updated.id, ...updated.data() } });
});

// Admin: notification policies
app.get("/api/v1/admin/notification-policies", requireAdmin, async (req, res) => {
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
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  });

  res.json({ policies });
});

app.post("/api/v1/admin/notification-policies", requireAdmin, async (req, res) => {
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

  // scope=course ならcourseId必須
  if (scope === "course" && !courseId) {
    res.status(400).json({ error: "course_id_required_for_course_scope" });
    return;
  }

  // scope=user ならuserId必須
  if (scope === "user" && !userId) {
    res.status(400).json({ error: "user_id_required_for_user_scope" });
    return;
  }

  // 講座の存在確認（scope=course）
  if (scope === "course" && courseId) {
    const courseSnap = await db.collection("courses").doc(courseId).get();
    if (!courseSnap.exists) {
      res.status(404).json({ error: "course_not_found" });
      return;
    }
  }

  // ユーザーの存在確認（scope=user）
  if (scope === "user" && userId) {
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: "user_not_found" });
      return;
    }
  }

  // 重複チェック（同じscope/courseId/userIdの組み合わせ）
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

app.patch("/api/v1/admin/notification-policies/:id", requireAdmin, async (req, res) => {
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

app.delete("/api/v1/admin/notification-policies/:id", requireAdmin, async (req, res) => {
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

// Admin: user settings (通知設定)
app.get("/api/v1/admin/users/:id/settings", requireAdmin, async (req, res) => {
  const userId = req.params.id as string;

  // ユーザーの存在確認
  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }

  // userSettings を取得（userIdで検索）
  const settingsSnap = await db
    .collection("userSettings")
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (settingsSnap.empty) {
    // デフォルト値を返す
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
    updatedAt: data.updatedAt,
  });
});

app.patch("/api/v1/admin/users/:id/settings", requireAdmin, async (req, res) => {
  const userId = req.params.id as string;

  // ユーザーの存在確認
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

  // 既存の設定を検索
  const settingsSnap = await db
    .collection("userSettings")
    .where("userId", "==", userId)
    .limit(1)
    .get();

  const now = new Date();
  updates.updatedAt = now;

  if (settingsSnap.empty) {
    // 新規作成
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
    // 更新
    const doc = settingsSnap.docs[0];
    await doc.ref.update(updates);

    const currentData = doc.data();
    res.json({ id: doc.id, ...currentData, ...updates });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API service listening on :${port}`);
});
