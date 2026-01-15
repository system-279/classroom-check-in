import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp({
    credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS!),
    projectId: "classroom-checkin-279",
  });
}

const db = getFirestore();

async function addAllowedEmail() {
  const email = process.argv[2] || "system@279279.net";

  // 既に存在するかチェック
  const existing = await db.collection("allowedEmails").where("email", "==", email).get();
  if (!existing.empty) {
    console.log("既に登録済み:", email);
    return;
  }

  await db.collection("allowedEmails").add({
    email,
    note: "初期管理者",
    createdAt: new Date(),
  });
  console.log("許可リストに追加:", email);
}

addAllowedEmail().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
