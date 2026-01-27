/**
 * スーパー管理者認可ミドルウェア
 * SUPER_ADMIN_EMAILS環境変数で指定されたメールアドレスのみアクセスを許可
 */

import type { Request, Response, NextFunction } from "express";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const authMode = process.env.AUTH_MODE ?? "dev";

// スーパー管理者メールアドレスリストを環境変数から取得
const superAdminEmails: string[] = (process.env.SUPER_ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter((email) => email.length > 0);

// Firebase Admin SDK初期化（firebase モードの場合のみ、未初期化の場合）
if (authMode === "firebase" && getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp({
      credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      projectId,
    });
  } else {
    initializeApp({ projectId });
  }
}

/**
 * スーパー管理者情報をリクエストに付与するための型拡張
 */
export interface SuperAdminUser {
  email: string;
  firebaseUid?: string;
}

declare global {
  namespace Express {
    interface Request {
      superAdmin?: SuperAdminUser;
    }
  }
}

/**
 * メールアドレスがスーパー管理者か判定
 */
export function isSuperAdmin(email: string | undefined): boolean {
  if (!email) return false;
  return superAdminEmails.includes(email.toLowerCase());
}

/**
 * スーパー管理者認可ミドルウェア
 * Firebase認証後、メールアドレスがSUPER_ADMIN_EMAILSに含まれるかチェック
 */
export const superAdminAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // スーパー管理者が設定されていない場合は機能を無効化
  if (superAdminEmails.length === 0) {
    return res.status(403).json({
      error: "forbidden",
      message: "スーパー管理者機能は無効です（SUPER_ADMIN_EMAILSが設定されていません）",
    });
  }

  if (authMode === "dev") {
    // 開発モード: X-User-Email ヘッダでスーパー管理者判定
    const headerEmail = req.header("x-user-email");

    if (!headerEmail) {
      return res.status(401).json({
        error: "unauthorized",
        message: "認証情報がありません",
      });
    }

    if (!isSuperAdmin(headerEmail)) {
      return res.status(403).json({
        error: "forbidden",
        message: "スーパー管理者権限が必要です",
      });
    }

    req.superAdmin = { email: headerEmail.toLowerCase() };
    return next();
  }

  if (authMode === "firebase") {
    // Firebase認証: Authorization: Bearer <ID Token>
    const authHeader = req.header("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "unauthorized",
        message: "認証情報がありません",
      });
    }

    const idToken = authHeader.slice(7);
    try {
      const decodedToken = await getAuth().verifyIdToken(idToken);
      const email = decodedToken.email;

      if (!isSuperAdmin(email)) {
        return res.status(403).json({
          error: "forbidden",
          message: "スーパー管理者権限が必要です",
        });
      }

      req.superAdmin = {
        email: email!.toLowerCase(),
        firebaseUid: decodedToken.uid,
      };
      return next();
    } catch (error) {
      console.error("Firebase token verification failed:", error);
      return res.status(401).json({
        error: "unauthorized",
        message: "認証に失敗しました",
      });
    }
  }

  // 不明なAUTH_MODEの場合
  return res.status(500).json({
    error: "internal_error",
    message: "不明な認証モードです",
  });
};
