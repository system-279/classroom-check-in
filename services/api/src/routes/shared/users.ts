/**
 * ユーザー関連の共通ルーター
 * DataSourceを使用してデモ/本番両対応
 */

import { Router, Request, Response } from "express";
import { requireUser, requireAdmin } from "../../middleware/auth.js";
import { toISOString } from "../../utils/date.js";
import {
  isValidEmail,
  isValidTimezone,
  VALID_ROLES,
} from "../../utils/validation.js";

const router = Router();

/**
 * 認証ユーザー情報取得
 * GET /auth/me
 */
router.get("/auth/me", requireUser, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

/**
 * 管理者向け: ユーザー一覧取得
 * GET /admin/users
 */
router.get("/admin/users", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const users = await ds.getUsers();

    res.json({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: toISOString(user.createdAt),
        updatedAt: toISOString(user.updatedAt),
      })),
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to fetch users" });
  }
});

/**
 * 管理者向け: ユーザー作成
 * POST /admin/users
 */
router.post("/admin/users", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const { email, name, role } = req.body;

    if (!email || !isValidEmail(email)) {
      res.status(400).json({ error: "invalid_email", message: "Valid email is required" });
      return;
    }

    if (role && !VALID_ROLES.includes(role)) {
      res.status(400).json({ error: "invalid_role", message: "Role must be admin, teacher, or student" });
      return;
    }

    // 既存ユーザーチェック
    const existing = await ds.getUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: "email_exists", message: "User with this email already exists" });
      return;
    }

    const user = await ds.createUser({
      email,
      name: name ?? null,
      role: role ?? "student",
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: toISOString(user.createdAt),
        updatedAt: toISOString(user.updatedAt),
      },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to create user" });
  }
});

/**
 * 管理者向け: ユーザー詳細取得
 * GET /admin/users/:id
 */
router.get("/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const id = req.params.id as string;

    const user = await ds.getUserById(id);
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: toISOString(user.createdAt),
        updatedAt: toISOString(user.updatedAt),
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to fetch user" });
  }
});

/**
 * 管理者向け: ユーザー更新
 * PATCH /admin/users/:id
 */
router.patch("/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const id = req.params.id as string;
    const { name, role } = req.body;

    const existing = await ds.getUserById(id);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }

    if (role && !VALID_ROLES.includes(role)) {
      res.status(400).json({ error: "invalid_role", message: "Role must be admin, teacher, or student" });
      return;
    }

    const user = await ds.updateUser(id, {
      ...(name !== undefined && { name }),
      ...(role !== undefined && { role }),
    });

    res.json({
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        role: user!.role,
        createdAt: toISOString(user!.createdAt),
        updatedAt: toISOString(user!.updatedAt),
      },
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to update user" });
  }
});

/**
 * 管理者向け: ユーザー削除
 * DELETE /admin/users/:id
 */
router.delete("/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const id = req.params.id as string;

    const existing = await ds.getUserById(id);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }

    await ds.deleteUser(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to delete user" });
  }
});

/**
 * 管理者向け: ユーザー設定取得
 * GET /admin/users/:id/settings
 */
router.get("/admin/users/:id/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const id = req.params.id as string;

    const user = await ds.getUserById(id);
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }

    const settings = await ds.getUserSettings(id);

    res.json({
      settings: settings ?? {
        userId: id,
        notificationEnabled: true,
        timezone: "Asia/Tokyo",
        updatedAt: null,
      },
    });
  } catch (error) {
    console.error("Error fetching user settings:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to fetch user settings" });
  }
});

/**
 * 管理者向け: ユーザー設定更新
 * PATCH /admin/users/:id/settings
 */
router.patch("/admin/users/:id/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ds = req.dataSource!;
    const id = req.params.id as string;
    const { notificationEnabled, timezone } = req.body;

    const user = await ds.getUserById(id);
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }

    if (timezone !== undefined && !isValidTimezone(timezone)) {
      res.status(400).json({ error: "invalid_timezone", message: "Invalid timezone" });
      return;
    }

    const settings = await ds.upsertUserSettings(id, {
      ...(notificationEnabled !== undefined && { notificationEnabled }),
      ...(timezone !== undefined && { timezone }),
    });

    res.json({ settings });
  } catch (error) {
    console.error("Error updating user settings:", error);
    res.status(500).json({ error: "internal_error", message: "Failed to update user settings" });
  }
});

export const usersRouter = router;
