/**
 * 認証エラーログ関連の共通ルーター
 * DataSourceを使用してデモ/本番両対応
 */

import { Router, Request, Response } from "express";
import { requireAdmin } from "../../middleware/auth.js";
import { toISOString } from "../../utils/date.js";

const router = Router();

/**
 * 管理者向け: 認証エラーログ一覧取得
 * GET /admin/auth-errors
 * クエリパラメータ:
 *   - email: メールアドレスでフィルタ
 *   - startDate: 開始日時（ISO 8601形式）
 *   - endDate: 終了日時（ISO 8601形式）
 *   - limit: 取得件数上限（デフォルト100、最大500）
 */
router.get("/admin/auth-errors", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;

    const email = req.query.email as string | undefined;
    const startDateStr = req.query.startDate as string | undefined;
    const endDateStr = req.query.endDate as string | undefined;
    const limitStr = req.query.limit as string | undefined;

    // パラメータをパース
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    let limit = limitStr ? parseInt(limitStr, 10) : 100;

    // 日付のバリデーション
    if (startDateStr && isNaN(startDate!.getTime())) {
      res.status(400).json({
        error: { code: "invalid_start_date", message: "startDate must be a valid ISO 8601 date" },
      });
      return;
    }
    if (endDateStr && isNaN(endDate!.getTime())) {
      res.status(400).json({
        error: { code: "invalid_end_date", message: "endDate must be a valid ISO 8601 date" },
      });
      return;
    }

    // limit のバリデーション
    if (isNaN(limit) || limit < 1) {
      limit = 100;
    } else if (limit > 500) {
      limit = 500;
    }

    const logs = await ds.getAuthErrorLogs({
      email,
      startDate,
      endDate,
      limit,
    });

    res.json({
      authErrorLogs: logs.map((log) => ({
        id: log.id,
        email: log.email,
        tenantId: log.tenantId,
        errorType: log.errorType,
        errorMessage: log.errorMessage,
        path: log.path,
        method: log.method,
        userAgent: log.userAgent,
        ipAddress: log.ipAddress,
        occurredAt: toISOString(log.occurredAt),
      })),
    });
  } catch (error) {
    console.error("Error fetching auth error logs:", error);
    res.status(500).json({
      error: { code: "internal_error", message: "Failed to fetch auth error logs" },
    });
  }
});

export const authErrorsRouter = router;
