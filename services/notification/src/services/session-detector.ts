import type { Firestore } from "@google-cloud/firestore";
import type { Session } from "../types.js";
import { toDate } from "../utils/date.js";

export async function findStaleSessions(
  db: Firestore,
  thresholdMinutes: number,
): Promise<Session[]> {
  const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000);

  const snapshot = await db
    .collection("sessions")
    .where("status", "==", "open")
    .where("lastHeartbeatAt", "<", threshold)
    .orderBy("lastHeartbeatAt", "asc")
    .limit(100)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      courseId: data.courseId,
      userId: data.userId,
      startTime: toDate(data.startTime),
      endTime: data.endTime ? toDate(data.endTime) : null,
      lastHeartbeatAt: toDate(data.lastHeartbeatAt),
      status: data.status,
    } as Session;
  });
}
