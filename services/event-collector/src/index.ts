import express from "express";
import { Firestore } from "@google-cloud/firestore";

const projectId =
  process.env.FIRESTORE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT;

const db = new Firestore(projectId ? { projectId } : undefined);

const app = express();
// 入力サイズ制限（100KB）
app.use(express.json({ limit: "100kb" }));

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

type VideoEventType =
  | "PLAY"
  | "PAUSE"
  | "HEARTBEAT"
  | "SEEK"
  | "RATE_CHANGE"
  | "ENDED";

interface VideoEventPayload {
  courseId: string;
  userId: string;
  videoId: string;
  eventType: VideoEventType;
  eventTime?: string;
  positionSec: number;
  playbackRate?: number;
  clientSessionId?: string;
  isVisible?: boolean;
}

const VALID_EVENT_TYPES: VideoEventType[] = [
  "PLAY",
  "PAUSE",
  "HEARTBEAT",
  "SEEK",
  "RATE_CHANGE",
  "ENDED",
];

app.post("/api/v1/events/video", async (req, res) => {
  const body = req.body as VideoEventPayload | undefined;

  // 必須フィールドのバリデーション
  if (!body?.courseId || !body?.userId || !body?.videoId) {
    res.status(400).json({
      error: "missing_required_fields",
      required: ["courseId", "userId", "videoId"],
    });
    return;
  }

  if (!body.eventType || !VALID_EVENT_TYPES.includes(body.eventType)) {
    res.status(400).json({
      error: "invalid_event_type",
      validTypes: VALID_EVENT_TYPES,
    });
    return;
  }

  if (typeof body.positionSec !== "number" || body.positionSec < 0) {
    res.status(400).json({ error: "invalid_position_sec" });
    return;
  }

  try {
    const eventTime = body.eventTime ? new Date(body.eventTime) : new Date();

    const eventDoc = {
      courseId: body.courseId,
      userId: body.userId,
      videoId: body.videoId,
      eventType: body.eventType,
      eventTime,
      positionSec: body.positionSec,
      playbackRate: body.playbackRate ?? 1.0,
      sourceRef: body.clientSessionId ?? null,
      payload: {
        isVisible: body.isVisible ?? true,
      },
      createdAt: new Date(),
    };

    const ref = await db.collection("videoPlaybackEvents").add(eventDoc);

    console.log(
      `[event] ${body.eventType} - course=${body.courseId} user=${body.userId} video=${body.videoId} pos=${body.positionSec}`
    );

    res.status(202).json({
      accepted: true,
      eventId: ref.id,
    });
  } catch (error) {
    console.error("[event] Failed to save event:", error);
    res.status(500).json({
      error: "internal_error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// バッチイベント受信（複数イベントを一括送信）
app.post("/api/v1/events/video/batch", async (req, res) => {
  const events = req.body?.events as VideoEventPayload[] | undefined;

  if (!Array.isArray(events) || events.length === 0) {
    res.status(400).json({ error: "events_array_required" });
    return;
  }

  if (events.length > 100) {
    res.status(400).json({ error: "too_many_events", max: 100 });
    return;
  }

  const results: { index: number; eventId?: string; error?: string }[] = [];
  const batch = db.batch();
  const eventRefs: FirebaseFirestore.DocumentReference[] = [];

  for (let i = 0; i < events.length; i++) {
    const body = events[i];

    // バリデーション
    if (!body?.courseId || !body?.userId || !body?.videoId) {
      results.push({ index: i, error: "missing_required_fields" });
      continue;
    }

    if (!body.eventType || !VALID_EVENT_TYPES.includes(body.eventType)) {
      results.push({ index: i, error: "invalid_event_type" });
      continue;
    }

    if (typeof body.positionSec !== "number" || body.positionSec < 0) {
      results.push({ index: i, error: "invalid_position_sec" });
      continue;
    }

    const eventTime = body.eventTime ? new Date(body.eventTime) : new Date();
    const ref = db.collection("videoPlaybackEvents").doc();

    batch.set(ref, {
      courseId: body.courseId,
      userId: body.userId,
      videoId: body.videoId,
      eventType: body.eventType,
      eventTime,
      positionSec: body.positionSec,
      playbackRate: body.playbackRate ?? 1.0,
      sourceRef: body.clientSessionId ?? null,
      payload: {
        isVisible: body.isVisible ?? true,
      },
      createdAt: new Date(),
    });

    eventRefs.push(ref);
    results.push({ index: i, eventId: ref.id });
  }

  try {
    await batch.commit();

    const accepted = results.filter((r) => r.eventId).length;
    const rejected = results.filter((r) => r.error).length;

    console.log(`[batch] Accepted ${accepted}, rejected ${rejected} events`);

    res.status(202).json({
      accepted,
      rejected,
      results,
    });
  } catch (error) {
    console.error("[batch] Failed to save events:", error);
    res.status(500).json({
      error: "internal_error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`Event Collector listening on :${port}`);
});
