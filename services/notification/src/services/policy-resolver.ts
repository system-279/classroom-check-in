import type { Firestore } from "@google-cloud/firestore";
import type { NotificationPolicy } from "../types.js";
import { tenantCollection } from "./tenant-helper.js";

const DEFAULT_POLICY: Omit<NotificationPolicy, "id" | "scope"> = {
  firstNotifyAfterMin: 60,
  repeatIntervalHours: 24,
  maxRepeatDays: 7,
  active: true,
};

export async function resolvePolicy(
  db: Firestore,
  tenantId: string,
  userId: string,
  courseId: string,
): Promise<NotificationPolicy> {
  const policiesRef = tenantCollection(db, tenantId, "notification_policies");

  // user > course > global の優先順で検索
  const userPolicySnap = await policiesRef
    .where("scope", "==", "user")
    .where("userId", "==", userId)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (!userPolicySnap.empty) {
    const doc = userPolicySnap.docs[0];
    return { id: doc.id, ...doc.data() } as NotificationPolicy;
  }

  const coursePolicySnap = await policiesRef
    .where("scope", "==", "course")
    .where("courseId", "==", courseId)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (!coursePolicySnap.empty) {
    const doc = coursePolicySnap.docs[0];
    return { id: doc.id, ...doc.data() } as NotificationPolicy;
  }

  const globalPolicySnap = await policiesRef
    .where("scope", "==", "global")
    .where("active", "==", true)
    .limit(1)
    .get();

  if (!globalPolicySnap.empty) {
    const doc = globalPolicySnap.docs[0];
    return { id: doc.id, ...doc.data() } as NotificationPolicy;
  }

  // ポリシーが存在しない場合はデフォルト値を返す
  return {
    id: "default",
    scope: "global",
    ...DEFAULT_POLICY,
  };
}

export async function getGlobalPolicy(
  db: Firestore,
  tenantId: string,
): Promise<NotificationPolicy> {
  const snapshot = await tenantCollection(db, tenantId, "notification_policies")
    .where("scope", "==", "global")
    .where("active", "==", true)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as NotificationPolicy;
  }

  return {
    id: "default",
    scope: "global",
    ...DEFAULT_POLICY,
  };
}
