import type { Firestore } from "@google-cloud/firestore";
import type { Mailer } from "../mailers/mailer.interface.js";
import type {
  Session,
  User,
  UserSettings,
  Course,
  NotificationPolicy,
  NotificationTarget,
} from "../types.js";
import { resolvePolicy } from "./policy-resolver.js";
import { shouldSendNotification, logNotification } from "./notification-logger.js";

async function getUser(db: Firestore, userId: string): Promise<User | null> {
  const doc = await db.collection("users").doc(userId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as User;
}

async function getUserSettings(
  db: Firestore,
  userId: string,
): Promise<UserSettings | null> {
  const snapshot = await db
    .collection("userSettings")
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as UserSettings;
}

async function getCourse(db: Firestore, courseId: string): Promise<Course | null> {
  const doc = await db.collection("courses").doc(courseId).get();
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

function buildEmailBody(target: NotificationTarget): string {
  const { session, user, course } = target;
  const duration = formatDuration(session.startTime);

  return `
${user.displayName} 様

講座「${course.name}」で入室から${duration}が経過していますが、退室処理が完了していません。

講座を終了している場合は、アプリにアクセスして「退室」ボタンを押してください。

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
  session: Session,
  mailFrom: string,
): Promise<{ result: ProcessResult; error?: string }> {
  const policy = await resolvePolicy(db, session.userId, session.courseId);

  const shouldSend = await shouldSendNotification(
    db,
    session.id,
    session.startTime,
    policy.repeatIntervalHours,
    policy.maxRepeatDays,
  );

  if (!shouldSend) {
    return { result: "skipped" };
  }

  const [user, userSettings, course] = await Promise.all([
    getUser(db, session.userId),
    getUserSettings(db, session.userId),
    getCourse(db, session.courseId),
  ]);

  if (!user) {
    return { result: "skipped", error: "user_not_found" };
  }

  if (!userSettings || !userSettings.notifyEnabled) {
    return { result: "skipped", error: "notifications_disabled" };
  }

  if (!userSettings.notifyEmail) {
    return { result: "skipped", error: "no_email_configured" };
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

  const emailBody = buildEmailBody(target);

  try {
    await mailer.send({
      to: userSettings.notifyEmail,
      subject: `【退室未完了】${course.name}`,
      body: emailBody,
    });

    await logNotification(db, {
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

    await logNotification(db, {
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
