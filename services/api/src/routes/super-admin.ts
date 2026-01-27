/**
 * スーパー管理者用API
 * 全テナントの管理操作を提供
 *
 * エンドポイント:
 * - GET /api/v2/super/tenants - 全テナント一覧（ページング対応）
 * - GET /api/v2/super/tenants/:id - テナント詳細（統計情報含む）
 * - PATCH /api/v2/super/tenants/:id - テナント更新（status変更）
 */

import { Router, Request, Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { superAdminAuthMiddleware } from "../middleware/super-admin.js";
import type { TenantMetadata, TenantStatus } from "../types/tenant.js";

const router = Router();

// 有効なステータス値
const VALID_STATUSES: TenantStatus[] = ["active", "suspended"];

// 全ルートにスーパー管理者認証を適用
router.use(superAdminAuthMiddleware);

/**
 * テナント一覧のレスポンス型
 */
interface TenantListResponse {
  tenants: TenantListItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface TenantListItem {
  id: string;
  name: string;
  ownerEmail: string;
  status: TenantStatus;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * テナント詳細のレスポンス型（統計情報含む）
 */
interface TenantDetailResponse {
  tenant: TenantMetadata & {
    createdAt: string | null;
    updatedAt: string | null;
  };
  stats: {
    userCount: number;
    courseCount: number;
    sessionCount: number;
  };
}

/**
 * 全テナント一覧を取得
 * GET /api/v2/super/tenants
 *
 * クエリパラメータ:
 * - status: "active" | "suspended" (optional) - ステータスフィルター
 * - limit: number (default: 50, max: 100) - 取得件数
 * - offset: number (default: 0) - オフセット
 * - sort: "createdAt" | "name" (default: "createdAt") - ソートキー
 * - order: "asc" | "desc" (default: "desc") - ソート順
 */
router.get("/tenants", async (req: Request, res: Response) => {
  try {
    const db = getFirestore();

    // クエリパラメータのパース
    const statusFilter = req.query.status as TenantStatus | undefined;
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 100);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const sortBy = (req.query.sort as string) || "createdAt";
    const sortOrder = (req.query.order as "asc" | "desc") || "desc";

    // ステータスフィルターのバリデーション
    if (statusFilter && !VALID_STATUSES.includes(statusFilter)) {
      res.status(400).json({
        error: "invalid_status",
        message: "statusは 'active' または 'suspended' を指定してください。",
      });
      return;
    }

    // ソートキーのバリデーション
    const validSortKeys = ["createdAt", "name", "updatedAt"];
    if (!validSortKeys.includes(sortBy)) {
      res.status(400).json({
        error: "invalid_sort",
        message: "sortは 'createdAt', 'name', 'updatedAt' のいずれかを指定してください。",
      });
      return;
    }

    // クエリ構築
    let query = db.collection("tenants").orderBy(sortBy, sortOrder);

    if (statusFilter) {
      query = db
        .collection("tenants")
        .where("status", "==", statusFilter)
        .orderBy(sortBy, sortOrder);
    }

    // 総件数を取得（ページネーション用）
    const countQuery = statusFilter
      ? db.collection("tenants").where("status", "==", statusFilter)
      : db.collection("tenants");
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;

    // ページング適用
    const snapshot = await query.offset(offset).limit(limit).get();

    const tenants: TenantListItem[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.id ?? doc.id,
        name: data.name ?? "",
        ownerEmail: data.ownerEmail ?? "",
        status: data.status ?? "active",
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    const response: TenantListResponse = {
      tenants,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + tenants.length < total,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching tenants:", error);
    res.status(500).json({
      error: "internal_error",
      message: "テナント一覧の取得に失敗しました。",
    });
  }
});

/**
 * テナント詳細を取得（統計情報含む）
 * GET /api/v2/super/tenants/:id
 */
router.get("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const db = getFirestore();

    // テナントメタデータを取得
    const tenantDoc = await db.collection("tenants").doc(id).get();
    if (!tenantDoc.exists) {
      res.status(404).json({
        error: "not_found",
        message: "テナントが見つかりません。",
      });
      return;
    }

    const tenantData = tenantDoc.data()!;

    // 統計情報を並列で取得
    const [userCountSnap, courseCountSnap, sessionCountSnap] = await Promise.all([
      db.collection(`tenants/${id}/users`).count().get(),
      db.collection(`tenants/${id}/courses`).count().get(),
      db.collection(`tenants/${id}/sessions`).count().get(),
    ]);

    const response: TenantDetailResponse = {
      tenant: {
        id: tenantData.id ?? id,
        name: tenantData.name ?? "",
        ownerId: tenantData.ownerId ?? "",
        ownerEmail: tenantData.ownerEmail ?? "",
        status: tenantData.status ?? "active",
        createdAt: tenantData.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: tenantData.updatedAt?.toDate?.()?.toISOString() ?? null,
      },
      stats: {
        userCount: userCountSnap.data().count,
        courseCount: courseCountSnap.data().count,
        sessionCount: sessionCountSnap.data().count,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching tenant:", error);
    res.status(500).json({
      error: "internal_error",
      message: "テナント詳細の取得に失敗しました。",
    });
  }
});

/**
 * テナントを更新（status変更）
 * PATCH /api/v2/super/tenants/:id
 *
 * リクエストボディ:
 * - status: "active" | "suspended" - 新しいステータス
 */
router.patch("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body as { status?: TenantStatus };

    // バリデーション
    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({
        error: "invalid_status",
        message: "statusは 'active' または 'suspended' を指定してください。",
      });
      return;
    }

    const db = getFirestore();

    // テナントの存在確認
    const tenantRef = db.collection("tenants").doc(id);
    const tenantDoc = await tenantRef.get();
    if (!tenantDoc.exists) {
      res.status(404).json({
        error: "not_found",
        message: "テナントが見つかりません。",
      });
      return;
    }

    const previousStatus = tenantDoc.data()?.status;

    // ステータス更新
    const now = new Date();
    await tenantRef.update({
      status,
      updatedAt: now,
    });

    // 操作ログを出力
    const superAdmin = req.superAdmin;
    console.log(
      `[SuperAdmin] Tenant status changed: ${id} (${previousStatus} -> ${status}) by ${superAdmin?.email}`
    );

    const updatedDoc = await tenantRef.get();
    const updatedData = updatedDoc.data()!;

    res.json({
      tenant: {
        id: updatedData.id ?? id,
        name: updatedData.name ?? "",
        ownerId: updatedData.ownerId ?? "",
        ownerEmail: updatedData.ownerEmail ?? "",
        status: updatedData.status ?? "active",
        createdAt: updatedData.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: updatedData.updatedAt?.toDate?.()?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Error updating tenant:", error);
    res.status(500).json({
      error: "internal_error",
      message: "テナントの更新に失敗しました。",
    });
  }
});

export const superAdminRouter = router;
