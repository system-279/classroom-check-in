import type { Firestore } from "@google-cloud/firestore";
import type { Mailer } from "../mailers/mailer.interface.js";
import type {
  User,
  UserSettings,
  Course,
  NotificationTarget,
} from "../types.js";
import type { TenantSession } from "./session-detector.js";
import { resolvePolicy } from "./policy-resolver.js";
import { shouldSendNotification, logNotification } from "./notification-logger.js";
import { tenantCollection } from "./tenant-helper.js";

async function getUser(
  db: Firestore,
  tenantId: string,
  userId: string,
): Promise<User | null> {
  const doc = await tenantCollection(db, tenantId, "users").doc(userId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as User;
}

async function getUserSettings(
  db: Firestore,
  tenantId: string,
  userId: string,
): Promise<UserSettings | null> {
  // API側と同様にドキュメントIDでユーザー設定を取得
  const doc = await tenantCollection(db, tenantId, "user_settings").doc(userId).get();
  if (!doc.exists) return null;

  const data = doc.data()!;
  return {
    userId,
    notificationEnabled: data.notificationEnabled ?? true,
    timezone: data.timezone ?? "Asia/Tokyo",
  };
}

async function getCourse(
  db: Firestore,
  tenantId: string,
  courseId: string,
): Promise<Course | null> {
  const doc = await tenantCollection(db, tenantId, "courses").doc(courseId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Course;
}

function formatDuration(startTime: Date): string {
  const now = Date.now();
  const diffMs = now - startTime.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}時間${minutes}分`;
  }
  return `${minutes}分`;
}

// Web UIのベースURL
const WEB_BASE_URL = process.env.WEB_BASE_URL || "https://web-102013220292.asia-northeast1.run.app";

function buildEmailBody(target: NotificationTarget, tenantId: string): string {
  const { session, user, course } = target;
  const duration = formatDuration(session.startTime);
  const checkoutUrl = `${WEB_BASE_URL}/${tenantId}/student/checkout/${session.id}`;
  const displayName = user.name ?? user.email;

  return `
${displayName} 様

講座「${course.name}」で入室から${duration}が経過していますが、退室処理が完了していません。

講座を終了している場合は、以下のリンクから退室打刻を行ってください。

【退室打刻ページ】
${checkoutUrl}

※退室打刻には必要視聴時間（${course.requiredWatchMin ?? 63}分）の経過が必要です。
※ログインが必要です（Googleアカウント）。

---
入室時刻: ${session.startTime.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
講座名: ${course.name}

※このメールは自動送信されています。
`.trim();
}

export type ProcessResult = "sent" | "skipped" | "failed";

export async function processSession(
  db: Firestore,
  mailer: Mailer,
  session: TenantSession,
  _mailFrom: string,
): Promise<{ result: ProcessResult; error?: string }> {
  const { tenantId } = session;
  const policy = await resolvePolicy(db, tenantId, session.userId, session.courseId);

  const shouldSend = await shouldSendNotification(
    db,
    tenantId,
    session.id,
    session.startTime,
    policy.repeatIntervalHours,
    policy.maxRepeatDays,
  );

  if (!shouldSend) {
    return { result: "skipped" };
  }

  const [user, userSettings, course] = await Promise.all([
    getUser(db, tenantId, session.userId),
    getUserSettings(db, tenantId, session.userId),
    getCourse(db, tenantId, session.courseId),
  ]);

  if (!user) {
    return { result: "skipped", error: "user_not_found" };
  }

  if (!user.email) {
    return { result: "skipped", error: "no_email_configured" };
  }

  // 通知設定がない場合はデフォルトで有効とみなす
  // 明示的に無効化されている場合のみスキップ
  if (userSettings && !userSettings.notificationEnabled) {
    return { result: "skipped", error: "notifications_disabled" };
  }

  if (!course) {
    return { result: "skipped", error: "course_not_found" };
  }

  const target: NotificationTarget = {
    session,
    user,
    userSettings,
    course,
    policy,
  };

  const emailBody = buildEmailBody(target, tenantId);

  try {
    await mailer.send({
      to: user.email,
      subject: `【退室未完了】${course.name}`,
      body: emailBody,
    });

    await logNotification(db, tenantId, {
      userId: session.userId,
      courseId: session.courseId,
      sessionId: session.id,
      type: "out_missing",
      channel: "email",
      sentAt: new Date(),
      status: "sent",
    });

    return { result: "sent" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await logNotification(db, tenantId, {
      userId: session.userId,
      courseId: session.courseId,
      sessionId: session.id,
      type: "out_missing",
      channel: "email",
      sentAt: new Date(),
      status: "failed",
      error: errorMessage,
    });

    return { result: "failed", error: errorMessage };
  }
}
