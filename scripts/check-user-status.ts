/**
 * 受講者ログイン状態確認スクリプト
 *
 * 指定されたメールアドレスについて、全テナントを横断して以下を確認する:
 *   - allowed_emails コレクションに登録されているか
 *   - users コレクションに登録されているか
 *   - users.firebaseUid が紐付いているか（=過去にログイン履歴あり）
 *
 * 出力規範（PII最小化）:
 *   - メールアドレス: 入力値（既知のためログに含めて可）
 *   - テナントID/テナント名: 運用情報として出力
 *   - ユーザー名/firebaseUid 等のPII: 出力しない（has-firebase-uid bool のみ）
 *
 * 使用方法:
 *   GitHub Actions: workflow_dispatch から呼び出し
 *   ローカル: GOOGLE_APPLICATION_CREDENTIALS 設定後 npx tsx scripts/check-user-status.ts "email1,email2"
 *
 * 参考: memory/feedback_firestore_prod_admin_via_workflow.md
 */

import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

interface PerTenantResult {
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  inAllowedEmails: boolean;
  inUsers: boolean;
  userHasFirebaseUid: boolean;
}

interface EmailCheckResult {
  email: string;
  totalTenantsChecked: number;
  foundInTenants: PerTenantResult[];
}

const MAX_EMAILS = 20;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(input: string | undefined): string[] {
  if (!input) {
    throw new Error("CHECK_EMAILS env var (or argv[2]) is required: comma-separated emails");
  }
  const raw = input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const deduped = Array.from(new Set(raw));

  if (deduped.length > MAX_EMAILS) {
    throw new Error(`Too many emails: ${deduped.length} (max ${MAX_EMAILS})`);
  }

  const invalid = deduped.filter((e) => !EMAIL_REGEX.test(e));
  if (invalid.length > 0) {
    throw new Error(`Invalid email format: ${invalid.length} entry/entries`);
  }

  return deduped;
}

async function checkEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  email: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tenantDocs: any[]
): Promise<EmailCheckResult> {
  const result: EmailCheckResult = {
    email,
    totalTenantsChecked: tenantDocs.length,
    foundInTenants: [],
  };

  for (const tenantDoc of tenantDocs) {
    const tenantId = tenantDoc.id;
    const tenantData = tenantDoc.data() ?? {};

    const [allowedSnap, usersSnap] = await Promise.all([
      db
        .collection(`tenants/${tenantId}/allowed_emails`)
        .where("email", "==", email)
        .limit(1)
        .get(),
      db
        .collection(`tenants/${tenantId}/users`)
        .where("email", "==", email)
        .limit(1)
        .get(),
    ]);

    const inAllowedEmails = !allowedSnap.empty;
    const inUsers = !usersSnap.empty;

    if (inAllowedEmails || inUsers) {
      const userHasFirebaseUid =
        inUsers && Boolean(usersSnap.docs[0].data()?.firebaseUid);

      result.foundInTenants.push({
        tenantId,
        tenantName: tenantData.name ?? "(unnamed)",
        tenantStatus: tenantData.status ?? "(unknown)",
        inAllowedEmails,
        inUsers,
        userHasFirebaseUid,
      });
    }
  }

  return result;
}

async function main(): Promise<void> {
  const emailsArg = process.env.CHECK_EMAILS ?? process.argv[2];
  const emails = parseEmails(emailsArg);

  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT_ID,
    });
  }
  const db = getFirestore();

  const tenantsSnap = await db.collection("tenants").get();

  console.log("=== Check User Login Status ===");
  console.log(`Target emails: ${emails.length} address(es)`);
  console.log(`Total tenants in project: ${tenantsSnap.size}`);
  console.log("");

  for (const email of emails) {
    const result = await checkEmail(db, email, tenantsSnap.docs);
    console.log(`--- ${result.email} ---`);
    if (result.foundInTenants.length === 0) {
      console.log(`  NOT FOUND in any of ${result.totalTenantsChecked} tenants`);
      console.log(`  -> 該当メールはアクセス許可リスト/受講者管理どちらにも未登録`);
    } else {
      for (const t of result.foundInTenants) {
        console.log(`  tenantId=${t.tenantId} (name=${JSON.stringify(t.tenantName)}, status=${t.tenantStatus})`);
        console.log(
          `    inAllowedEmails=${t.inAllowedEmails}, inUsers=${t.inUsers}, userHasFirebaseUid=${t.userHasFirebaseUid}`
        );
        const judgement = (() => {
          if (!t.inAllowedEmails && !t.inUsers) return "  -> N/A";
          if (t.inAllowedEmails && t.inUsers && t.userHasFirebaseUid) return "  -> ✅ ログイン経験あり（正常）";
          if (t.inAllowedEmails && t.inUsers && !t.userHasFirebaseUid) return "  -> ⚠️ 受講者管理に登録あるが未ログイン（初回ログインで firebaseUid が紐付くはず）";
          if (t.inAllowedEmails && !t.inUsers) return "  -> ⚠️ アクセス許可リストにあるが受講者管理に未登録（初回ログイン時に自動作成される）";
          if (!t.inAllowedEmails && t.inUsers) return "  -> ❌ 受講者管理にはあるが許可リストに未登録 → ログイン不可の主原因候補（ADR-0027 以前の登録など）";
          return "";
        })();
        console.log(judgement);
      }
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error("ERROR:", err instanceof Error ? err.message : err);
  process.exit(1);
});
