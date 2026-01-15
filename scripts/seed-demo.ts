/**
 * デモ用シードデータ投入スクリプト
 *
 * 使用方法:
 *   npx tsx scripts/seed-demo.ts
 *
 * 環境変数:
 *   GOOGLE_APPLICATION_CREDENTIALS - サービスアカウントJSONパス
 */

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credentialsPath) {
  console.error("環境変数 GOOGLE_APPLICATION_CREDENTIALS が設定されていません");
  process.exit(1);
}

const serviceAccount = JSON.parse(
  readFileSync(credentialsPath, "utf-8")
) as ServiceAccount;

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

// デモ用ユーザーデータ
const demoUsers = [
  {
    id: "demo-admin",
    email: "admin@demo.example.com",
    name: "管理者デモ",
    role: "admin",
    firebaseUid: "demo-firebase-uid-admin",
  },
  {
    id: "demo-teacher",
    email: "teacher@demo.example.com",
    name: "講師デモ",
    role: "teacher",
    firebaseUid: "demo-firebase-uid-teacher",
  },
  {
    id: "demo-student-1",
    email: "student1@demo.example.com",
    name: "受講者A",
    role: "student",
    firebaseUid: "demo-firebase-uid-student1",
  },
  {
    id: "demo-student-2",
    email: "student2@demo.example.com",
    name: "受講者B",
    role: "student",
    firebaseUid: "demo-firebase-uid-student2",
  },
  {
    id: "demo-student-3",
    email: "student3@demo.example.com",
    name: "受講者C",
    role: "student",
    firebaseUid: "demo-firebase-uid-student3",
  },
];

// デモ用講座データ
const demoCourses = [
  {
    id: "demo-course-1",
    name: "プログラミング基礎",
    description: "プログラミングの基本概念を学ぶ入門講座",
    classroomUrl: "https://classroom.google.com/c/demo1",
    enabled: true,
    visible: true,
    note: "デモ用講座",
  },
  {
    id: "demo-course-2",
    name: "Web開発入門",
    description: "HTML/CSS/JavaScriptの基礎",
    classroomUrl: "https://classroom.google.com/c/demo2",
    enabled: true,
    visible: true,
    note: "デモ用講座",
  },
  {
    id: "demo-course-3",
    name: "データサイエンス入門",
    description: "Pythonを使ったデータ分析の基礎",
    classroomUrl: "https://classroom.google.com/c/demo3",
    enabled: true,
    visible: false, // 非表示の例
    note: "デモ用講座（非表示）",
  },
];

// デモ用受講登録データ
const demoEnrollments = [
  // プログラミング基礎 - 全受講者
  { courseId: "demo-course-1", userId: "demo-student-1", role: "student" },
  { courseId: "demo-course-1", userId: "demo-student-2", role: "student" },
  { courseId: "demo-course-1", userId: "demo-student-3", role: "student" },
  { courseId: "demo-course-1", userId: "demo-teacher", role: "teacher" },
  // Web開発入門 - 受講者A,B
  { courseId: "demo-course-2", userId: "demo-student-1", role: "student" },
  { courseId: "demo-course-2", userId: "demo-student-2", role: "student" },
  { courseId: "demo-course-2", userId: "demo-teacher", role: "teacher" },
  // データサイエンス入門 - 受講者Cのみ
  { courseId: "demo-course-3", userId: "demo-student-3", role: "student" },
];

// デモ用セッションデータ
const now = new Date();
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

const demoSessions = [
  // 継続中のセッション
  {
    id: "demo-session-1",
    courseId: "demo-course-1",
    userId: "demo-student-1",
    startTime: oneHourAgo,
    endTime: null,
    durationSec: 0,
    source: "manual",
    status: "open",
    lastHeartbeatAt: new Date(now.getTime() - 5 * 60 * 1000), // 5分前
  },
  // 正常終了したセッション
  {
    id: "demo-session-2",
    courseId: "demo-course-1",
    userId: "demo-student-2",
    startTime: twoHoursAgo,
    endTime: oneHourAgo,
    durationSec: 3600,
    source: "manual",
    status: "closed",
    lastHeartbeatAt: oneHourAgo,
  },
  // 補正済みセッション
  {
    id: "demo-session-3",
    courseId: "demo-course-2",
    userId: "demo-student-1",
    startTime: yesterday,
    endTime: new Date(yesterday.getTime() + 90 * 60 * 1000),
    durationSec: 5400,
    source: "manual",
    status: "adjusted",
    lastHeartbeatAt: new Date(yesterday.getTime() + 90 * 60 * 1000),
  },
  // 昨日の終了済みセッション
  {
    id: "demo-session-4",
    courseId: "demo-course-1",
    userId: "demo-student-3",
    startTime: new Date(yesterday.getTime() + 2 * 60 * 60 * 1000),
    endTime: new Date(yesterday.getTime() + 3.5 * 60 * 60 * 1000),
    durationSec: 5400,
    source: "manual",
    status: "closed",
    lastHeartbeatAt: new Date(yesterday.getTime() + 3.5 * 60 * 60 * 1000),
  },
];

// デモ用通知ポリシー
const demoNotificationPolicies = [
  {
    id: "demo-policy-global",
    scope: "global",
    courseId: null,
    userId: null,
    firstNotifyAfterMin: 120, // 2時間後
    repeatIntervalHours: 24,
    maxRepeatDays: 3,
    active: true,
  },
];

async function seedDemo(): Promise<void> {
  console.log("デモ用シードデータを投入します...\n");

  const batch = db.batch();
  const now = new Date();

  // アクセス許可リスト
  console.log("1. アクセス許可リストを作成...");
  for (const user of demoUsers) {
    const ref = db.collection("allowedEmails").doc(`demo-allowed-${user.id}`);
    batch.set(ref, {
      email: user.email,
      note: `デモ用: ${user.name}`,
      createdAt: now,
    });
  }

  // ユーザー
  console.log("2. ユーザーを作成...");
  for (const user of demoUsers) {
    const ref = db.collection("users").doc(user.id);
    batch.set(ref, {
      email: user.email,
      name: user.name,
      role: user.role,
      firebaseUid: user.firebaseUid,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 講座
  console.log("3. 講座を作成...");
  for (const course of demoCourses) {
    const ref = db.collection("courses").doc(course.id);
    batch.set(ref, {
      name: course.name,
      description: course.description,
      classroomUrl: course.classroomUrl,
      enabled: course.enabled,
      visible: course.visible,
      note: course.note,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 受講登録
  console.log("4. 受講登録を作成...");
  for (let i = 0; i < demoEnrollments.length; i++) {
    const enrollment = demoEnrollments[i];
    const ref = db.collection("enrollments").doc(`demo-enrollment-${i}`);
    batch.set(ref, {
      courseId: enrollment.courseId,
      userId: enrollment.userId,
      role: enrollment.role,
      startAt: now,
      endAt: null,
      createdAt: now,
    });
  }

  // セッション
  console.log("5. セッションを作成...");
  for (const session of demoSessions) {
    const ref = db.collection("sessions").doc(session.id);
    batch.set(ref, {
      courseId: session.courseId,
      userId: session.userId,
      startTime: session.startTime,
      endTime: session.endTime,
      durationSec: session.durationSec,
      source: session.source,
      status: session.status,
      lastHeartbeatAt: session.lastHeartbeatAt,
    });
  }

  // 通知ポリシー
  console.log("6. 通知ポリシーを作成...");
  for (const policy of demoNotificationPolicies) {
    const ref = db.collection("notificationPolicies").doc(policy.id);
    batch.set(ref, {
      scope: policy.scope,
      courseId: policy.courseId,
      userId: policy.userId,
      firstNotifyAfterMin: policy.firstNotifyAfterMin,
      repeatIntervalHours: policy.repeatIntervalHours,
      maxRepeatDays: policy.maxRepeatDays,
      active: policy.active,
    });
  }

  await batch.commit();

  console.log("\n完了しました。\n");
  console.log("=== 投入されたデモデータ ===");
  console.log(`ユーザー: ${demoUsers.length}名`);
  demoUsers.forEach((u) => console.log(`  - ${u.name} (${u.email}) [${u.role}]`));
  console.log(`講座: ${demoCourses.length}件`);
  demoCourses.forEach((c) => console.log(`  - ${c.name} ${c.visible ? "" : "(非表示)"}`));
  console.log(`受講登録: ${demoEnrollments.length}件`);
  console.log(`セッション: ${demoSessions.length}件`);
  console.log(`通知ポリシー: ${demoNotificationPolicies.length}件`);
  console.log(`アクセス許可: ${demoUsers.length}件`);
  console.log("\n注意: これはデモ用データです。本番運用前に clear-data.ts でクリアしてください。");
}

seedDemo().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
