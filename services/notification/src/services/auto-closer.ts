/**
 * 48時間経過したセッションの自動クローズ（ADR-0020）
 */

import type { Firestore } from "@google-cloud/firestore";
import type { TenantSession } from "./session-detector.js";
import { tenantCollection } from "./tenant-helper.js";
import { toDate } from "../utils/date.js";

// 自動クローズ閾値: 48時間（分）
const AUTO_CLOSE_THRESHOLD_MINUTES = 48 * 60;

export interface AutoCloseResult {
  closed: number;
  errors: string[];
}

/**
 * 48時間以上経過したopenセッションを検出
 */
export async function findExpiredSessions(
  db: Firestore,
  tenantId: string,
): Promise<TenantSession[]> {
  const threshold = new Date(Date.now() - AUTO_CLOSE_THRESHOLD_MINUTES * 60 * 1000);

  const snapshot = await tenantCollection(db, tenantId, "sessions")
    .where("status", "==", "open")
    .where("startTime", "<", threshold)
    .orderBy("startTime", "asc")
    .limit(50)
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

/**
 * セッションを自動クローズする
 * endTimeはlastHeartbeatAtを使用
 */
export async function autoCloseSession(
  db: Firestore,
  tenantId: string,
  session: TenantSession,
): Promise<void> {
  const endTime = session.lastHeartbeatAt;
  const durationSec = Math.max(
    0,
    Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000),
  );

  await tenantCollection(db, tenantId, "sessions")
    .doc(session.id)
    .update({
      endTime,
      durationSec,
      status: "closed",
      source: "auto_expired",
      updatedAt: new Date(),
    });

  console.log(
    `[auto-close] Closed session ${session.id}: started=${session.startTime.toISOString()}, ended=${endTime.toISOString()}, duration=${durationSec}s`,
  );
}

/**
 * テナント内の期限切れセッションを自動クローズ
 */
export async function autoCloseExpiredSessions(
  db: Firestore,
  tenantId: string,
): Promise<AutoCloseResult> {
  const result: AutoCloseResult = {
    closed: 0,
    errors: [],
  };

  try {
    const expiredSessions = await findExpiredSessions(db, tenantId);

    for (const session of expiredSessions) {
      try {
        await autoCloseSession(db, tenantId, session);
        result.closed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`Session ${session.id}: ${errorMessage}`);
        console.error(
          `[auto-close] Failed to close session ${session.id}:`,
          error,
        );
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`Query error: ${errorMessage}`);
    console.error(`[auto-close] Failed to query expired sessions:`, error);
  }

  return result;
}
