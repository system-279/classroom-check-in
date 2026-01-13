import type { Request, Response, NextFunction } from "express";

type Role = "admin" | "teacher" | "student";

export type AuthUser = {
  id: string;
  role: Role;
  email?: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const authMode = process.env.AUTH_MODE ?? "dev";

export const authMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  if (authMode === "dev") {
    // 開発モード: ヘッダ疑似認証（X-User-Id, X-User-Role, X-User-Email）
    const id = req.header("x-user-id");
    const role = (req.header("x-user-role") as Role | null) ?? "student";
    const email = req.header("x-user-email") ?? undefined;

    if (id) {
      req.user = { id, role, email };
    }
  }
  // 本番認証は未実装（OAuth審査が必要なため後日検討）
  // req.user が設定されない場合、requireUser/requireAdmin で 401/403 が返る

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
