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
import {
  superAdminAuthMiddleware,
  getAllSuperAdmins,
  addSuperAdmin,
  removeSuperAdmin,
} from "../middleware/super-admin.js";
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

// ============================================
// スーパー管理者管理API
// ============================================

/**
 * スーパー管理者一覧を取得
 * GET /api/v2/super/admins
 */
router.get("/admins", async (req: Request, res: Response) => {
  try {
    const admins = await getAllSuperAdmins();
    res.json({ admins });
  } catch (error) {
    console.error("Error fetching super admins:", error);
    res.status(500).json({
      error: "internal_error",
      message: "スーパー管理者一覧の取得に失敗しました。",
    });
  }
});

/**
 * スーパー管理者を追加
 * POST /api/v2/super/admins
 */
router.post("/admins", async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };

    // バリデーション
    if (!email || typeof email !== "string") {
      res.status(400).json({
        error: "invalid_email",
        message: "有効なメールアドレスを指定してください。",
      });
      return;
    }

    // 簡易的なメールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        error: "invalid_email",
        message: "有効なメールアドレス形式で指定してください。",
      });
      return;
    }

    const addedBy = req.superAdmin?.email ?? "unknown";
    await addSuperAdmin(email, addedBy);

    res.status(201).json({
      message: "スーパー管理者を追加しました。",
      admin: {
        email: email.toLowerCase(),
        source: "firestore",
        addedBy,
        addedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error adding super admin:", error);
    res.status(500).json({
      error: "internal_error",
      message: "スーパー管理者の追加に失敗しました。",
    });
  }
});

/**
 * スーパー管理者を削除
 * DELETE /api/v2/super/admins/:email
 */
router.delete("/admins/:email", async (req: Request, res: Response) => {
  try {
    const email = decodeURIComponent(req.params.email as string);

    // 環境変数で設定された管理者は削除できない
    const admins = await getAllSuperAdmins();
    const targetAdmin = admins.find((a) => a.email === email.toLowerCase());

    if (!targetAdmin) {
      res.status(404).json({
        error: "not_found",
        message: "指定されたスーパー管理者が見つかりません。",
      });
      return;
    }

    if (targetAdmin.source === "env") {
      res.status(400).json({
        error: "cannot_delete",
        message: "環境変数で設定されたスーパー管理者は削除できません。",
      });
      return;
    }

    // 自分自身は削除できない
    if (req.superAdmin?.email === email.toLowerCase()) {
      res.status(400).json({
        error: "cannot_delete_self",
        message: "自分自身を削除することはできません。",
      });
      return;
    }

    await removeSuperAdmin(email);

    console.log(`[SuperAdmin] Admin removed: ${email} by ${req.superAdmin?.email}`);

    res.json({
      message: "スーパー管理者を削除しました。",
    });
  } catch (error) {
    console.error("Error removing super admin:", error);
    res.status(500).json({
      error: "internal_error",
      message: "スーパー管理者の削除に失敗しました。",
    });
  }
});

export const superAdminRouter = router;
