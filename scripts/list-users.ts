/**
 * ユーザー一覧表示スクリプト
 *
 * 使用方法:
 *   npx tsx scripts/list-users.ts
 */

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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

async function listUsers(): Promise<void> {
  const usersSnap = await db.collection("users").get();

  if (usersSnap.empty) {
    console.log("ユーザーがいません");
    return;
  }

  console.log("登録済みユーザー一覧:\n");
  console.log("ID\t\t\t\t\tメール\t\t\t\tロール\t作成日");
  console.log("-".repeat(100));

  usersSnap.docs.forEach((doc) => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.()?.toISOString?.() ?? "不明";
    console.log(
      `${doc.id}\t${data.email ?? "(未設定)"}\t${data.role}\t${createdAt}`
    );
  });
}

listUsers().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
