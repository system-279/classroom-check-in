import type { Request, Response } from "express";
import type { Firestore } from "@google-cloud/firestore";
import type { Mailer } from "./mailers/mailer.interface.js";
import type { RunResult } from "./types.js";
import { getGlobalPolicy } from "./services/policy-resolver.js";
import { findStaleSessions } from "./services/session-detector.js";
import { processSession } from "./services/notification-sender.js";

export async function runHandler(
  req: Request,
  res: Response,
  db: Firestore,
  mailer: Mailer,
  mailFrom: string,
): Promise<void> {
  const result: RunResult = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    const globalPolicy = await getGlobalPolicy(db);
    console.log(
      `[run] Using threshold: ${globalPolicy.firstNotifyAfterMin} minutes`,
    );

    const staleSessions = await findStaleSessions(
      db,
      globalPolicy.firstNotifyAfterMin,
    );
    console.log(`[run] Found ${staleSessions.length} stale sessions`);

    for (const session of staleSessions) {
      result.processed++;

      try {
        const { result: processResult, error } = await processSession(
          db,
          mailer,
          session,
          mailFrom,
        );

        switch (processResult) {
          case "sent":
            result.sent++;
            console.log(`[run] Sent notification for session ${session.id}`);
            break;
          case "skipped":
            result.skipped++;
            if (error) {
              console.log(
                `[run] Skipped session ${session.id}: ${error}`,
              );
            }
            break;
          case "failed":
            result.failed++;
            result.errors.push(`Session ${session.id}: ${error}`);
            console.error(
              `[run] Failed to process session ${session.id}: ${error}`,
            );
            break;
        }
      } catch (error) {
        result.failed++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        result.errors.push(`Session ${session.id}: ${errorMessage}`);
        console.error(
          `[run] Unexpected error processing session ${session.id}:`,
          error,
        );
      }
    }

    console.log(
      `[run] Complete: processed=${result.processed}, sent=${result.sent}, skipped=${result.skipped}, failed=${result.failed}`,
    );
    res.json(result);
  } catch (error) {
    console.error("[run] Fatal error:", error);
    res.status(500).json({
      error: "internal_error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
