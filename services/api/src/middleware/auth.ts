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
  if (authMode !== "dev") {
    next();
    return;
  }

  const id = req.header("x-user-id");
  const role = (req.header("x-user-role") as Role | null) ?? "student";
  const email = req.header("x-user-email") ?? undefined;

  if (id) {
    req.user = { id, role, email };
  }

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
