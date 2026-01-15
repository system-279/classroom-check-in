import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp({
    credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS!),
    projectId: "classroom-checkin-279",
  });
}

const db = getFirestore();

async function addAdminUser() {
  const email = process.argv[2] || "system@279279.net";

  // 既に存在するかチェック
  const existing = await db.collection("users").where("email", "==", email).get();
  if (!existing.empty) {
    const doc = existing.docs[0];
    if (doc.data().role !== "admin") {
      await doc.ref.update({ role: "admin", updatedAt: new Date() });
      console.log("adminロールに更新:", email);
    } else {
      console.log("既にadmin:", email);
    }
    return;
  }

  await db.collection("users").add({
    email,
    name: "管理者",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log("管理者ユーザーを作成:", email);
}

addAdminUser().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
