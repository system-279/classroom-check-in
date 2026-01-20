import type { Firestore, CollectionReference } from "@google-cloud/firestore";

export interface TenantInfo {
  id: string;
  name: string;
  status: string;
}

/**
 * アクティブなテナント一覧を取得
 */
export async function getActiveTenants(db: Firestore): Promise<TenantInfo[]> {
  const snapshot = await db
    .collection("tenants")
    .where("status", "==", "active")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name,
    status: doc.data().status,
  }));
}

/**
 * テナントのサブコレクションを取得
 */
export function tenantCollection(
  db: Firestore,
  tenantId: string,
  collectionName: string,
): CollectionReference {
  return db.collection("tenants").doc(tenantId).collection(collectionName);
}
