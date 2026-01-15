/**
 * 管理者設定スクリプト
 *
 * 使用方法:
 *   npx tsx scripts/set-admin.ts <email>
 *
 * 例:
 *   npx tsx scripts/set-admin.ts admin@example.com
 */

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credentialsPath) {
  console.error("環境変数 GOOGLE_APPLICATION_CREDENTIALS が設定されていません");
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error("使用方法: npx tsx scripts/set-admin.ts <email>");
  process.exit(1);
}

const serviceAccount = JSON.parse(
  readFileSync(credentialsPath, "utf-8")
) as ServiceAccount;

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function setAdmin(email: string): Promise<void> {
  // メールアドレスでユーザーを検索
  const usersSnap = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (usersSnap.empty) {
    console.error(`ユーザーが見つかりません: ${email}`);
    console.log("\n登録済みユーザー一覧:");
    const allUsers = await db.collection("users").get();
    if (allUsers.empty) {
      console.log("  (ユーザーがいません)");
    } else {
      allUsers.docs.forEach((doc) => {
        const data = doc.data();
        console.log(`  - ${data.email ?? "(email未設定)"} (role: ${data.role})`);
      });
    }
    process.exit(1);
  }

  const doc = usersSnap.docs[0];
  const data = doc.data();

  if (data.role === "admin") {
    console.log(`${email} は既に管理者です`);
    process.exit(0);
  }

  // roleをadminに更新
  await doc.ref.update({
    role: "admin",
    updatedAt: new Date(),
  });

  console.log(`${email} を管理者に設定しました`);
}

setAdmin(email).catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
