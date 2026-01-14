import express from "express";
import { Firestore, Timestamp } from "@google-cloud/firestore";

const projectId =
  process.env.FIRESTORE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT;

const db = new Firestore(projectId ? { projectId } : undefined);

// 定数
const NORMAL_SPEED_MIN = 0.9;
const NORMAL_SPEED_MAX = 1.1;
const RANGE_MERGE_TOLERANCE_SEC = 1;
const PROCESSING_WINDOW_HOURS = 24;

const app = express();
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

interface VideoPlaybackEvent {
  id: string;
  courseId: string;
  userId: string;
  videoId: string;
  eventType: string;
  eventTime: Timestamp;
  positionSec: number;
  playbackRate: number;
  sourceRef: string | null;
}

interface WatchedRange {
  start: number;
  end: number;
  playbackRate: number;
}

// セッション再計算ジョブ
app.post("/run", async (_req, res) => {
  console.log("[session] Starting session recalculation job");

  try {
    const results = {
      videoWatchSessionsCreated: 0,
      sessionsUpdated: 0,
      errors: [] as string[],
    };

    // 1. 未処理の動画イベントを集約してVideoWatchSessionを生成/更新
    await processVideoPlaybackEvents(results);

    // 2. 動画視聴完了に基づいてopenセッションを更新
    await updateOpenSessionsFromVideoCompletion(results);

    console.log(
      `[session] Job completed: ${results.videoWatchSessionsCreated} watch sessions, ${results.sessionsUpdated} sessions updated`
    );

    res.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("[session] Job failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// 動画視聴イベントをVideoWatchSessionに集約
async function processVideoPlaybackEvents(results: {
  videoWatchSessionsCreated: number;
  errors: string[];
}) {
  // 過去PROCESSING_WINDOW_HOURSのイベントを処理対象とする
  const since = new Date(
    Date.now() - PROCESSING_WINDOW_HOURS * 60 * 60 * 1000
  );

  const eventsSnap = await db
    .collection("videoPlaybackEvents")
    .where("eventTime", ">=", since)
    .orderBy("eventTime", "asc")
    .get();

  if (eventsSnap.empty) {
    console.log("[session] No recent video events to process");
    return;
  }

  // ユーザー・コース・動画ごとにグループ化
  const eventsBySession = new Map<string, VideoPlaybackEvent[]>();

  eventsSnap.forEach((doc) => {
    const data = doc.data() as Omit<VideoPlaybackEvent, "id">;
    const event: VideoPlaybackEvent = { id: doc.id, ...data };
    const key = `${event.userId}:${event.courseId}:${event.videoId}`;

    if (!eventsBySession.has(key)) {
      eventsBySession.set(key, []);
    }
    eventsBySession.get(key)!.push(event);
  });

  console.log(
    `[session] Processing ${eventsBySession.size} video watch sessions`
  );

  for (const [key, events] of eventsBySession) {
    try {
      await createOrUpdateVideoWatchSession(events, results);
    } catch (error) {
      const msg = `Failed to process session ${key}: ${error}`;
      console.error(`[session] ${msg}`);
      results.errors.push(msg);
    }
  }
}

// VideoWatchSessionを生成/更新
async function createOrUpdateVideoWatchSession(
  events: VideoPlaybackEvent[],
  results: { videoWatchSessionsCreated: number; errors: string[] }
) {
  if (events.length === 0) return;

  const firstEvent = events[0];
  const { userId, courseId, videoId } = firstEvent;

  // 既存のVideoWatchSessionを検索
  const existingSnap = await db
    .collection("videoWatchSessions")
    .where("userId", "==", userId)
    .where("courseId", "==", courseId)
    .where("videoId", "==", videoId)
    .where("status", "==", "in_progress")
    .limit(1)
    .get();

  // 視聴区間を計算
  const watchedRanges = calculateWatchedRanges(events);
  const { coverageRatio, normalSpeedRatio } =
    calculateCoverageMetrics(watchedRanges);

  // 完了判定: ENDEDイベントが1xで発生したか
  const hasCompletedAt1x = events.some(
    (e) =>
      e.eventType === "ENDED" &&
      e.playbackRate >= NORMAL_SPEED_MIN &&
      e.playbackRate <= NORMAL_SPEED_MAX
  );

  const status = hasCompletedAt1x ? "completed" : "in_progress";

  const startTime =
    events.find((e) => e.eventType === "PLAY")?.eventTime.toDate() ||
    firstEvent.eventTime.toDate();
  const endTime =
    events.findLast(
      (e: VideoPlaybackEvent) =>
        e.eventType === "ENDED" || e.eventType === "PAUSE"
    )?.eventTime.toDate() || null;

  const sessionData = {
    userId,
    courseId,
    videoId,
    startTime,
    endTime,
    watchedRanges,
    coverageRatio,
    normalSpeedRatio,
    status,
    updatedAt: new Date(),
    // sessionClosedAt: セッションクローズ処理済みなら日時、未処理ならnull
    ...(status === "completed" ? {} : { sessionClosedAt: null }),
  };

  if (!existingSnap.empty) {
    // 更新
    await existingSnap.docs[0].ref.update(sessionData);
    console.log(
      `[session] Updated VideoWatchSession for user=${userId} video=${videoId}`
    );
  } else {
    // 新規作成
    await db.collection("videoWatchSessions").add({
      ...sessionData,
      sessionClosedAt: null,
      createdAt: new Date(),
    });
    results.videoWatchSessionsCreated++;
    console.log(
      `[session] Created VideoWatchSession for user=${userId} video=${videoId}`
    );
  }
}

// 視聴区間を計算
function calculateWatchedRanges(events: VideoPlaybackEvent[]): WatchedRange[] {
  const ranges: WatchedRange[] = [];
  let currentRange: WatchedRange | null = null;
  let lastRate = 1.0;

  for (const event of events) {
    switch (event.eventType) {
      case "PLAY":
        if (!currentRange) {
          currentRange = {
            start: event.positionSec,
            end: event.positionSec,
            playbackRate: event.playbackRate || 1.0,
          };
        }
        lastRate = event.playbackRate || 1.0;
        break;

      case "PAUSE":
      case "ENDED":
        if (currentRange) {
          currentRange.end = event.positionSec;
          ranges.push(currentRange);
          currentRange = null;
        }
        break;

      case "HEARTBEAT":
        if (currentRange) {
          currentRange.end = event.positionSec;
        }
        break;

      case "RATE_CHANGE":
        // 速度変更時は現在の区間を閉じて新しい区間を開始
        if (currentRange) {
          currentRange.end = event.positionSec;
          ranges.push(currentRange);
          currentRange = {
            start: event.positionSec,
            end: event.positionSec,
            playbackRate: event.playbackRate || 1.0,
          };
        }
        lastRate = event.playbackRate || 1.0;
        break;

      case "SEEK":
        // シーク時は現在の区間を閉じて新しい位置から開始
        if (currentRange) {
          ranges.push(currentRange);
          currentRange = {
            start: event.positionSec,
            end: event.positionSec,
            playbackRate: lastRate,
          };
        }
        break;
    }
  }

  // 未クローズの区間を追加
  if (currentRange) {
    ranges.push(currentRange);
  }

  return mergeOverlappingRanges(ranges);
}

// 重複する区間をマージ
function mergeOverlappingRanges(ranges: WatchedRange[]): WatchedRange[] {
  if (ranges.length === 0) return [];

  // 開始位置でソート
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: WatchedRange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end + RANGE_MERGE_TOLERANCE_SEC) {
      // 重複または連続: マージ
      last.end = Math.max(last.end, current.end);
      // 速度が異なる場合は1xでない方を優先（判定に影響するため）
      if (
        Math.abs(current.playbackRate - 1.0) >
        Math.abs(last.playbackRate - 1.0)
      ) {
        last.playbackRate = current.playbackRate;
      }
    } else {
      merged.push(current);
    }
  }

  return merged;
}

// カバレッジ指標を計算
function calculateCoverageMetrics(ranges: WatchedRange[]): {
  coverageRatio: number;
  normalSpeedRatio: number;
} {
  if (ranges.length === 0) {
    return { coverageRatio: 0, normalSpeedRatio: 0 };
  }

  let totalWatched = 0;
  let normalSpeedWatched = 0;

  for (const range of ranges) {
    const duration = range.end - range.start;
    totalWatched += duration;

    // 1x (NORMAL_SPEED_MIN-NORMAL_SPEED_MAX の範囲) を通常速度とみなす
    if (
      range.playbackRate >= NORMAL_SPEED_MIN &&
      range.playbackRate <= NORMAL_SPEED_MAX
    ) {
      normalSpeedWatched += duration;
    }
  }

  // 最大位置から動画長を推定（VideoAssetがない場合の簡易計算）
  const maxPosition = Math.max(...ranges.map((r) => r.end));
  const estimatedDuration = maxPosition > 0 ? maxPosition : 1;

  return {
    coverageRatio: Math.min(1, totalWatched / estimatedDuration),
    normalSpeedRatio: totalWatched > 0 ? normalSpeedWatched / totalWatched : 0,
  };
}

// 動画視聴完了に基づいてopenセッションを更新
async function updateOpenSessionsFromVideoCompletion(results: {
  sessionsUpdated: number;
  errors: string[];
}) {
  // 過去PROCESSING_WINDOW_HOURS以内に完了したVideoWatchSessionを取得
  const since = new Date(
    Date.now() - PROCESSING_WINDOW_HOURS * 60 * 60 * 1000
  );

  // sessionClosedAtが未設定（未処理）のもののみ取得
  const completedWatchSnap = await db
    .collection("videoWatchSessions")
    .where("status", "==", "completed")
    .where("sessionClosedAt", "==", null)
    .get();

  if (completedWatchSnap.empty) {
    console.log("[session] No completed video watch sessions to process");
    return;
  }

  console.log(
    `[session] Processing ${completedWatchSnap.size} completed watch sessions`
  );

  for (const doc of completedWatchSnap.docs) {
    const watchSession = doc.data();

    try {
      // 該当ユーザー・コースのopenセッションを検索
      const openSessionSnap = await db
        .collection("sessions")
        .where("userId", "==", watchSession.userId)
        .where("courseId", "==", watchSession.courseId)
        .where("status", "==", "open")
        .limit(1)
        .get();

      if (openSessionSnap.empty) {
        continue;
      }

      const sessionDoc = openSessionSnap.docs[0];
      const session = sessionDoc.data();

      // 動画視聴終了時刻をセッション終了時刻として使用
      const endTime = watchSession.endTime?.toDate?.() || new Date();
      const startTime = session.startTime?.toDate?.() || new Date();
      const durationSec = Math.floor(
        (endTime.getTime() - startTime.getTime()) / 1000
      );

      const now = new Date();

      await sessionDoc.ref.update({
        endTime,
        durationSec,
        status: "closed",
        closedBy: "video_completion",
        updatedAt: now,
      });

      // VideoWatchSessionを処理済みとしてマーク
      await doc.ref.update({
        sessionClosedAt: now,
      });

      // AttendanceEvent (OUT) を記録
      await db.collection("attendanceEvents").add({
        courseId: watchSession.courseId,
        userId: watchSession.userId,
        eventType: "OUT",
        eventTime: endTime,
        source: "video",
        sourceRef: doc.id,
        payload: { videoId: watchSession.videoId },
        createdAt: now,
      });

      results.sessionsUpdated++;
      console.log(
        `[session] Closed session ${sessionDoc.id} based on video completion`
      );
    } catch (error) {
      const msg = `Failed to update session for watch ${doc.id}: ${error}`;
      console.error(`[session] ${msg}`);
      results.errors.push(msg);
    }
  }
}

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`Session Processor listening on :${port}`);
});
