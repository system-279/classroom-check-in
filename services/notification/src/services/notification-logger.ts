import type { Firestore } from "@google-cloud/firestore";
import type { NotificationLog } from "../types.js";
import { toDate } from "../utils/date.js";

export async function getLatestNotificationLog(
  db: Firestore,
  sessionId: string,
): Promise<NotificationLog | null> {
  const snapshot = await db
    .collection("notificationLogs")
    .where("sessionId", "==", sessionId)
    .where("status", "==", "sent")
    .orderBy("sentAt", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId,
    courseId: data.courseId,
    sessionId: data.sessionId,
    type: data.type,
    channel: data.channel,
    sentAt: toDate(data.sentAt),
    status: data.status,
    error: data.error,
  } as NotificationLog;
}

export async function logNotification(
  db: Firestore,
  log: Omit<NotificationLog, "id">,
): Promise<string> {
  const docRef = await db.collection("notificationLogs").add({
    ...log,
    sentAt: log.sentAt,
  });
  return docRef.id;
}

export async function shouldSendNotification(
  db: Firestore,
  sessionId: string,
  sessionStartTime: Date,
  repeatIntervalHours: number,
  maxRepeatDays: number,
): Promise<boolean> {
  const lastLog = await getLatestNotificationLog(db, sessionId);

  if (!lastLog) {
    return true;
  }

  const now = Date.now();
  const hoursSinceLastNotification =
    (now - lastLog.sentAt.getTime()) / (1000 * 60 * 60);

  if (hoursSinceLastNotification < repeatIntervalHours) {
    return false;
  }

  const daysSinceSessionStart =
    (now - sessionStartTime.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceSessionStart > maxRepeatDays) {
    return false;
  }

  return true;
}
