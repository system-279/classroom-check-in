/**
 * Firestoreデータクリアスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/clear-data.ts [--confirm]
 *
 * オプション:
 *   --confirm  確認プロンプトをスキップ
 *
 * 環境変数:
 *   GOOGLE_APPLICATION_CREDENTIALS - サービスアカウントJSONパス
 *
 * 警告: このスクリプトは全データを削除します。本番環境での実行には十分注意してください。
 */

import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import * as readline from "node:readline";

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

// クリア対象のコレクション
const collectionsToDelete = [
  "allowedEmails",
  "users",
  "userSettings",
  "courses",
  "enrollments",
  "sessions",
  "notificationPolicies",
  "notificationLogs",
  "attendanceEvents",
];

async function deleteCollection(collectionName: string): Promise<number> {
  const collectionRef = db.collection(collectionName);
  const snapshot = await collectionRef.get();

  if (snapshot.empty) {
    return 0;
  }

  // Firestoreは一度に500件までバッチ削除可能
  const batchSize = 500;
  let deleted = 0;

  while (true) {
    const batch = db.batch();
    const docs = await collectionRef.limit(batchSize).get();

    if (docs.empty) {
      break;
    }

    docs.docs.forEach((doc) => {
      batch.delete(doc.ref);
      deleted++;
    });

    await batch.commit();
  }

  return deleted;
}

async function countDocuments(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  for (const collection of collectionsToDelete) {
    const snapshot = await db.collection(collection).get();
    counts.set(collection, snapshot.size);
  }

  return counts;
}

async function promptConfirmation(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("本当に全データを削除しますか？ (yes/no): ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes");
    });
  });
}

async function clearData(): Promise<void> {
  console.log("=== Firestoreデータクリアスクリプト ===\n");

  // 現在のデータ件数を確認
  console.log("現在のデータ件数:");
  const counts = await countDocuments();
  let totalCount = 0;

  for (const [collection, count] of counts) {
    console.log(`  ${collection}: ${count}件`);
    totalCount += count;
  }

  console.log(`\n合計: ${totalCount}件\n`);

  if (totalCount === 0) {
    console.log("削除するデータがありません。");
    return;
  }

  // --confirm オプションがなければ確認プロンプトを表示
  const skipConfirm = process.argv.includes("--confirm");

  if (!skipConfirm) {
    console.log("警告: この操作は取り消せません！");
    const confirmed = await promptConfirmation();

    if (!confirmed) {
      console.log("キャンセルしました。");
      return;
    }
  }

  console.log("\nデータを削除中...\n");

  for (const collection of collectionsToDelete) {
    const count = counts.get(collection) ?? 0;
    if (count > 0) {
      const deleted = await deleteCollection(collection);
      console.log(`  ${collection}: ${deleted}件削除`);
    }
  }

  console.log("\n完了しました。全データが削除されました。");
  console.log("\n本番運用を開始するには:");
  console.log("  1. 管理画面からアクセス許可リストにメールアドレスを登録");
  console.log("  2. 許可されたユーザーがGoogleログインでサインイン");
  console.log("  3. 管理画面から講座・受講者を登録");
}

clearData().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
