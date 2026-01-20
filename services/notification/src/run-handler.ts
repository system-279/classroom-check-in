import type { Request, Response } from "express";
import type { Firestore } from "@google-cloud/firestore";
import type { Mailer } from "./mailers/mailer.interface.js";
import type { RunResult } from "./types.js";
import { getGlobalPolicy } from "./services/policy-resolver.js";
import { findStaleSessions } from "./services/session-detector.js";
import { processSession } from "./services/notification-sender.js";
import { getActiveTenants } from "./services/tenant-helper.js";

interface TenantResult extends RunResult {
  tenantId: string;
  tenantName: string;
}

interface AggregatedResult {
  totalProcessed: number;
  totalSent: number;
  totalSkipped: number;
  totalFailed: number;
  tenants: TenantResult[];
  errors: string[];
}

export async function runHandler(
  req: Request,
  res: Response,
  db: Firestore,
  mailer: Mailer,
  mailFrom: string,
): Promise<void> {
  const aggregatedResult: AggregatedResult = {
    totalProcessed: 0,
    totalSent: 0,
    totalSkipped: 0,
    totalFailed: 0,
    tenants: [],
    errors: [],
  };

  try {
    // 全アクティブテナントを取得
    const tenants = await getActiveTenants(db);
    console.log(`[run] Found ${tenants.length} active tenants`);

    if (tenants.length === 0) {
      console.log("[run] No active tenants found, skipping");
      res.json(aggregatedResult);
      return;
    }

    // 各テナントを処理
    for (const tenant of tenants) {
      const tenantResult: TenantResult = {
        tenantId: tenant.id,
        tenantName: tenant.name,
        processed: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        errors: [],
      };

      try {
        const globalPolicy = await getGlobalPolicy(db, tenant.id);
        console.log(
          `[run] Tenant ${tenant.id}: Using threshold ${globalPolicy.firstNotifyAfterMin} minutes`,
        );

        const staleSessions = await findStaleSessions(
          db,
          tenant.id,
          globalPolicy.firstNotifyAfterMin,
        );
        console.log(
          `[run] Tenant ${tenant.id}: Found ${staleSessions.length} stale sessions`,
        );

        for (const session of staleSessions) {
          tenantResult.processed++;

          try {
            const { result: processResult, error } = await processSession(
              db,
              mailer,
              session,
              mailFrom,
            );

            switch (processResult) {
              case "sent":
                tenantResult.sent++;
                console.log(
                  `[run] Tenant ${tenant.id}: Sent notification for session ${session.id}`,
                );
                break;
              case "skipped":
                tenantResult.skipped++;
                if (error) {
                  console.log(
                    `[run] Tenant ${tenant.id}: Skipped session ${session.id}: ${error}`,
                  );
                }
                break;
              case "failed":
                tenantResult.failed++;
                tenantResult.errors.push(`Session ${session.id}: ${error}`);
                console.error(
                  `[run] Tenant ${tenant.id}: Failed to process session ${session.id}: ${error}`,
                );
                break;
            }
          } catch (error) {
            tenantResult.failed++;
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            tenantResult.errors.push(`Session ${session.id}: ${errorMessage}`);
            console.error(
              `[run] Tenant ${tenant.id}: Unexpected error processing session ${session.id}:`,
              error,
            );
          }
        }

        console.log(
          `[run] Tenant ${tenant.id} complete: processed=${tenantResult.processed}, sent=${tenantResult.sent}, skipped=${tenantResult.skipped}, failed=${tenantResult.failed}`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        tenantResult.errors.push(`Tenant error: ${errorMessage}`);
        console.error(`[run] Tenant ${tenant.id}: Fatal error:`, error);
      }

      // 集計
      aggregatedResult.totalProcessed += tenantResult.processed;
      aggregatedResult.totalSent += tenantResult.sent;
      aggregatedResult.totalSkipped += tenantResult.skipped;
      aggregatedResult.totalFailed += tenantResult.failed;
      aggregatedResult.errors.push(...tenantResult.errors);
      aggregatedResult.tenants.push(tenantResult);
    }

    console.log(
      `[run] All tenants complete: totalProcessed=${aggregatedResult.totalProcessed}, totalSent=${aggregatedResult.totalSent}, totalSkipped=${aggregatedResult.totalSkipped}, totalFailed=${aggregatedResult.totalFailed}`,
    );
    res.json(aggregatedResult);
  } catch (error) {
    console.error("[run] Fatal error:", error);
    res.status(500).json({
      error: "internal_error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
