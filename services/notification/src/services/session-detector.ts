import type { Firestore } from "@google-cloud/firestore";
import type { Session } from "../types.js";
import { toDate } from "../utils/date.js";
import { tenantCollection } from "./tenant-helper.js";

export interface TenantSession extends Session {
  tenantId: string;
}

export async function findStaleSessions(
  db: Firestore,
  tenantId: string,
  thresholdMinutes: number,
): Promise<TenantSession[]> {
  const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000);

  const snapshot = await tenantCollection(db, tenantId, "sessions")
    .where("status", "==", "open")
    .where("lastHeartbeatAt", "<", threshold)
    .orderBy("lastHeartbeatAt", "asc")
    .limit(100)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      tenantId,
      courseId: data.courseId,
      userId: data.userId,
      startTime: toDate(data.startTime),
      endTime: data.endTime ? toDate(data.endTime) : null,
      lastHeartbeatAt: toDate(data.lastHeartbeatAt),
      status: data.status,
    } as TenantSession;
  });
}
