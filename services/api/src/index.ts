import express from "express";
import { authMiddleware, requireAdmin, requireUser } from "./middleware/auth.js";
import { db } from "./storage/firestore.js";

const app = express();
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
  const courseTargetsSnap = await db
    .collection("courseTargets")
    .where("visible", "==", true)
    .where("enabled", "==", true)
    .get();

  const courseTargetDocs = courseTargetsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  let courseIds = courseTargetDocs.map((target) => target.courseId as string);
  if (courseIds.length === 0) {
    res.json({ courses: [] });
    return;
  }

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

  const enrollmentCourseIds = new Set(
    enrollmentSnaps
      .filter((snap) => !snap.empty)
      .map((snap) => snap.docs[0].data().courseId as string),
  );

  if (enrollmentCourseIds.size > 0) {
    courseIds = courseIds.filter((id) => enrollmentCourseIds.has(id));
  }

  const courseSnaps = await Promise.all(
    courseIds.map((id) => db.collection("courses").doc(id).get()),
  );

  const courses = courseSnaps
    .filter((doc) => doc.exists)
    .map((doc) => {
      const data = doc.data() ?? {};
      const target = courseTargetDocs.find((t) => t.courseId === doc.id);
      return {
        id: doc.id,
        externalCourseId: data.externalCourseId,
        name: data.name,
        classroomUrl: data.classroomUrl,
        enabled: target?.enabled ?? false,
        visible: target?.visible ?? false,
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

  const targetSnap = await db
    .collection("courseTargets")
    .where("courseId", "==", courseId)
    .where("enabled", "==", true)
    .limit(1)
    .get();

  if (targetSnap.empty) {
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
  const targetsSnap = await db.collection("courseTargets").get();
  const targetsByCourse = new Map(
    targetsSnap.docs.map((doc) => [doc.data().courseId as string, doc]),
  );

  const courses = coursesSnap.docs.map((doc) => {
    const data = doc.data();
    const targetDoc = targetsByCourse.get(doc.id);
    return {
      id: doc.id,
      externalCourseId: data.externalCourseId,
      name: data.name,
      classroomUrl: data.classroomUrl,
      enabled: targetDoc?.data()?.enabled ?? false,
      visible: targetDoc?.data()?.visible ?? false,
      targetId: targetDoc?.id ?? null,
    };
  });

  res.json({ courses });
});

app.post("/api/v1/admin/course-targets", requireAdmin, async (req, res) => {
  const courseId = req.body?.courseId;
  const enabled = req.body?.enabled ?? true;
  const visible = req.body?.visible ?? true;
  const normalizedVisible = enabled ? visible : false;

  if (!courseId) {
    res.status(400).json({ error: "course_id_required" });
    return;
  }

  const existing = await db
    .collection("courseTargets")
    .where("courseId", "==", courseId)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    await doc.ref.update({ enabled, visible: normalizedVisible });
    res.json({ id: doc.id, courseId, enabled, visible: normalizedVisible });
    return;
  }

  const ref = await db.collection("courseTargets").add({
    courseId,
    enabled,
    visible: normalizedVisible,
  });
  res.json({ id: ref.id, courseId, enabled, visible: normalizedVisible });
});

app.patch("/api/v1/admin/course-targets/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const updates: Record<string, unknown> = {};
  if (typeof req.body?.enabled === "boolean") {
    updates.enabled = req.body.enabled;
  }
  if (typeof req.body?.visible === "boolean") {
    updates.visible = req.body.visible;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "no_updates" });
    return;
  }

  const ref = db.collection("courseTargets").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: "course_target_not_found" });
    return;
  }

  const enabled = typeof updates.enabled === "boolean" ? updates.enabled : snap.data()?.enabled;
  const visible =
    typeof updates.visible === "boolean" ? updates.visible : snap.data()?.visible;
  const normalizedVisible = enabled ? visible : false;

  await ref.update({ ...updates, visible: normalizedVisible });
  res.json({ id, ...snap.data(), ...updates, visible: normalizedVisible });
});

// Admin: sync
app.post("/api/v1/admin/sync/classroom", requireAdmin, notImplemented);
app.get("/api/v1/admin/sync/status", requireAdmin, notImplemented);

// Admin: sessions
app.get("/api/v1/admin/sessions", requireAdmin, notImplemented);
app.post("/api/v1/admin/sessions/:id/close", requireAdmin, notImplemented);

// Admin: notification policies
app.get("/api/v1/admin/notification-policies", requireAdmin, notImplemented);
app.post("/api/v1/admin/notification-policies", requireAdmin, notImplemented);
app.patch("/api/v1/admin/notification-policies/:id", requireAdmin, notImplemented);

// Admin: forms
app.get("/api/v1/admin/forms", requireAdmin, notImplemented);
app.post("/api/v1/admin/forms", requireAdmin, notImplemented);
app.patch("/api/v1/admin/forms/:id", requireAdmin, notImplemented);

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API service listening on :${port}`);
});
