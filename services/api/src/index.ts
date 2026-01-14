import cors from "cors";
import express from "express";
import { authMiddleware, requireAdmin, requireUser } from "./middleware/auth.js";
import { db } from "./storage/firestore.js";

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000", "http://localhost:3001"],
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

  await ref.delete();
  res.json({ deleted: true, id });
});

// Admin: sessions (未実装)
app.get("/api/v1/admin/sessions", requireAdmin, notImplemented);
app.post("/api/v1/admin/sessions/:id/close", requireAdmin, notImplemented);

// Admin: notification policies (未実装)
app.get("/api/v1/admin/notification-policies", requireAdmin, notImplemented);
app.post("/api/v1/admin/notification-policies", requireAdmin, notImplemented);
app.patch("/api/v1/admin/notification-policies/:id", requireAdmin, notImplemented);

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API service listening on :${port}`);
});
