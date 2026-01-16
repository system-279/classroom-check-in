/**
 * 共通ルーターの統合エクスポート
 * DataSourceを使用してデモ/本番両対応
 */

import { Router } from "express";
import { coursesRouter } from "./courses.js";
import { sessionsRouter } from "./sessions.js";
import { usersRouter } from "./users.js";
import { enrollmentsRouter } from "./enrollments.js";
import { notificationPoliciesRouter } from "./notification-policies.js";
import { allowedEmailsRouter } from "./allowed-emails.js";

/**
 * 全ての共通ルーターを統合したルーター
 * テナントコンテキストミドルウェアの後に使用する
 */
export function createSharedRouter(): Router {
  const router = Router();

  // 各機能のルーターをマウント
  router.use(coursesRouter);
  router.use(sessionsRouter);
  router.use(usersRouter);
  router.use(enrollmentsRouter);
  router.use(notificationPoliciesRouter);
  router.use(allowedEmailsRouter);

  return router;
}

// 個別ルーターのエクスポート
export { coursesRouter } from "./courses.js";
export { sessionsRouter } from "./sessions.js";
export { usersRouter } from "./users.js";
export { enrollmentsRouter } from "./enrollments.js";
export { notificationPoliciesRouter } from "./notification-policies.js";
export { allowedEmailsRouter } from "./allowed-emails.js";
