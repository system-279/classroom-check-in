/**
 * 本番Firestoreからデモ用シードデータを削除するスクリプト
 * demo- プレフィックスを持つドキュメントを削除
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp({
    credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS!),
    projectId: "classroom-checkin-279",
  });
}

const db = getFirestore();

const COLLECTIONS_TO_CLEAN = [
  "courses",
  "users",
  "enrollments",
  "sessions",
  "attendanceEvents",
  "notificationPolicies",
  "notificationLogs",
  "allowedEmails",
  "userSettings",
];

async function removeDemoData() {
  console.log("Removing demo data from Firestore...");

  for (const collectionName of COLLECTIONS_TO_CLEAN) {
    console.log(`\nProcessing collection: ${collectionName}`);

    const snapshot = await db.collection(collectionName).get();
    const demoDocsToDelete = snapshot.docs.filter(doc => doc.id.startsWith("demo-"));

    if (demoDocsToDelete.length === 0) {
      console.log(`  No demo documents found`);
      continue;
    }

    console.log(`  Found ${demoDocsToDelete.length} demo documents to delete`);

    // バッチ削除（500件ずつ）
    const BATCH_SIZE = 500;
    for (let i = 0; i < demoDocsToDelete.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = demoDocsToDelete.slice(i, i + BATCH_SIZE);
      chunk.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`  Deleted ${chunk.length} documents`);
    }
  }

  console.log("\nDemo data removal complete!");
}

removeDemoData()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
