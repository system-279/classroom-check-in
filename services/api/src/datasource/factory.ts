/**
 * DataSource ファクトリ
 * テナントコンテキストに応じたDataSourceを生成
 */

import { Firestore } from "@google-cloud/firestore";
import type { DataSource } from "./interface.js";
import { InMemoryDataSource } from "./in-memory.js";
import { FirestoreDataSource } from "./firestore.js";

export interface TenantContext {
  tenantId: string;
  isDemo: boolean;
}

// Firestoreインスタンスのキャッシュ
let firestoreInstance: Firestore | null = null;

function getFirestore(): Firestore {
  if (!firestoreInstance) {
    const projectId =
      process.env.FIRESTORE_PROJECT_ID ||
      process.env.GCLOUD_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT;

    firestoreInstance = new Firestore(
      projectId
        ? {
            projectId,
          }
        : undefined
    );
  }
  return firestoreInstance;
}

// デモ用DataSourceのシングルトン
const demoDataSource = new InMemoryDataSource({ readOnly: true });

/**
 * テナントコンテキストに応じたDataSourceを取得
 * @throws Error tenantIdが未指定の場合（デモモード以外）
 */
export function getDataSource(context: TenantContext): DataSource {
  if (context.isDemo) {
    return demoDataSource;
  }

  // 本番用: tenantIdのバリデーション
  if (!context.tenantId) {
    throw new Error("tenantId is required for non-demo DataSource");
  }

  // 本番用: FirestoreDataSource（テナントID付き）
  return new FirestoreDataSource(getFirestore(), context.tenantId);
}

/**
 * デフォルトのDataSourceを取得（後方互換性用）
 * 空文字列のtenantIdはレガシーモード（ルート直下のコレクションを使用）
 * @deprecated テナント対応後は getDataSource を使用すること
 */
export function getDefaultDataSource(): DataSource {
  return new FirestoreDataSource(getFirestore(), "");
}
