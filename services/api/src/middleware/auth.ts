import type { Request, Response, NextFunction } from "express";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { db } from "../storage/firestore.js";

type Role = "admin" | "teacher" | "student";

export type AuthUser = {
  id: string;
  role: Role;
  email?: string;
  firebaseUid?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const authMode = process.env.AUTH_MODE ?? "dev";

// Firebase Admin SDK初期化（firebase モードの場合のみ）
if (authMode === "firebase" && getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // サービスアカウント認証（ローカル開発・Cloud Run）
    initializeApp({
      credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      projectId,
    });
  } else {
    // デフォルト認証情報（Cloud Run等）
    initializeApp({ projectId });
  }
}

/**
 * firebaseUidからユーザーを検索、なければ自動作成
 */
async function findOrCreateUser(decodedToken: DecodedIdToken): Promise<AuthUser> {
  const { uid, email } = decodedToken;

  // firebaseUidでユーザーを検索
  const usersSnap = await db
    .collection("users")
    .where("firebaseUid", "==", uid)
    .limit(1)
    .get();

  if (!usersSnap.empty) {
    const doc = usersSnap.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      role: (data.role as Role) ?? "student",
      email: data.email,
      firebaseUid: uid,
    };
  }

  // メールアドレスで既存ユーザーを検索（firebaseUidがまだ設定されていない場合）
  if (email) {
    const emailSnap = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!emailSnap.empty) {
      const doc = emailSnap.docs[0];
      // firebaseUidを設定
      await doc.ref.update({ firebaseUid: uid, updatedAt: new Date() });
      const data = doc.data();
      return {
        id: doc.id,
        role: (data.role as Role) ?? "student",
        email: data.email,
        firebaseUid: uid,
      };
    }
  }

  // 新規ユーザー作成（初回ログイン）
  const now = new Date();
  const ref = await db.collection("users").add({
    email: email ?? null,
    name: decodedToken.name ?? null,
    role: "student",
    firebaseUid: uid,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id: ref.id,
    role: "student",
    email: email ?? undefined,
    firebaseUid: uid,
  };
}

export const authMiddleware = async (req: Request, _res: Response, next: NextFunction) => {
  if (authMode === "dev") {
    // 開発モード: ヘッダ疑似認証（X-User-Id, X-User-Role, X-User-Email）
    const id = req.header("x-user-id");
    const role = (req.header("x-user-role") as Role | null) ?? "student";
    const email = req.header("x-user-email") ?? undefined;

    if (id) {
      req.user = { id, role, email };
    }
    return next();
  }

  if (authMode === "firebase") {
    // Firebase認証: Authorization: Bearer <ID Token>
    const authHeader = req.header("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return next();
    }

    const idToken = authHeader.slice(7);
    try {
      const decodedToken = await getAuth().verifyIdToken(idToken);
      req.user = await findOrCreateUser(decodedToken);
    } catch (error) {
      // トークン検証失敗時は req.user を設定しない（401はrequireUserで処理）
      console.error("Firebase token verification failed:", error);
    }
    return next();
  }

  // 不明なAUTH_MODEの場合
  next();
};

export const requireUser = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  next();
};
