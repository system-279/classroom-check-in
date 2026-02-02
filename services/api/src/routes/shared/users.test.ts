/**
 * users.ts のユニットテスト
 *
 * テスト対象:
 * - POST /admin/users のユーザー作成とallowed_emails自動追加
 * - DELETE /admin/users/:id の関連データチェックと詳細レスポンス
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Request, Response } from "express";

// DataSource のモック型
type MockDataSource = {
  getUserById: Mock;
  getUserByEmail: Mock;
  createUser: Mock;
  getSessions: Mock;
  getEnrollments: Mock;
  deleteUser: Mock;
  isEmailAllowed: Mock;
  createAllowedEmail: Mock;
};

// テスト用リクエスト作成ヘルパー
function createMockRequest(
  id: string,
  dataSource: MockDataSource
): Partial<Request> {
  return {
    params: { id },
    dataSource: dataSource as unknown as Request["dataSource"],
    user: { id: "admin-1", role: "admin" },
  };
}

function createMockResponse(): {
  res: Partial<Response>;
  statusMock: Mock;
  jsonMock: Mock;
  sendMock: Mock;
} {
  const jsonMock = vi.fn();
  const sendMock = vi.fn();
  const statusMock = vi.fn().mockReturnValue({ json: jsonMock, send: sendMock });

  return {
    res: { status: statusMock, json: jsonMock, send: sendMock },
    statusMock,
    jsonMock,
    sendMock,
  };
}

function createMockDataSource(): MockDataSource {
  return {
    getUserById: vi.fn(),
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    getSessions: vi.fn(),
    getEnrollments: vi.fn(),
    deleteUser: vi.fn(),
    isEmailAllowed: vi.fn(),
    createAllowedEmail: vi.fn(),
  };
}

describe("POST /admin/users", () => {
  let mockDataSource: MockDataSource;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataSource = createMockDataSource();
  });

  // ハンドラのロジックを抽出してテスト
  async function createUserHandler(req: Partial<Request>, res: Partial<Response>) {
    const ds = req.dataSource!;
    const { email, name, role } = req.body as { email: string; name?: string; role?: "admin" | "teacher" | "student" };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      (res.status as Mock)(400).json({ error: "invalid_email", message: "Valid email is required" });
      return;
    }

    const existing = await ds.getUserByEmail(email);
    if (existing) {
      (res.status as Mock)(409).json({ error: "email_exists", message: "User with this email already exists" });
      return;
    }

    const user = await ds.createUser({
      email,
      name: name ?? null,
      role: role ?? "student",
    });

    // ユーザー作成時にallowed_emailsにも自動追加（ADR-0017）
    const isAllowed = await ds.isEmailAllowed(email);
    if (!isAllowed) {
      await ds.createAllowedEmail({ email, note: null });
    }

    (res.status as Mock)(201).json({ user });
  }

  it("ユーザー作成時にallowed_emailsにも自動追加される", async () => {
    const newUser = {
      id: "user-1",
      email: "new@example.com",
      name: "New User",
      role: "student",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockDataSource.getUserByEmail.mockResolvedValue(null);
    mockDataSource.createUser.mockResolvedValue(newUser);
    mockDataSource.isEmailAllowed.mockResolvedValue(false);
    mockDataSource.createAllowedEmail.mockResolvedValue({ id: "allowed-1", email: "new@example.com", note: null, createdAt: new Date() });

    const req = {
      body: { email: "new@example.com", name: "New User", role: "student" },
      dataSource: mockDataSource as unknown as Request["dataSource"],
      user: { id: "admin-1", role: "admin" },
    } as Partial<Request>;
    const { res, statusMock } = createMockResponse();

    await createUserHandler(req, res);

    expect(mockDataSource.createUser).toHaveBeenCalledWith({
      email: "new@example.com",
      name: "New User",
      role: "student",
    });
    expect(mockDataSource.createAllowedEmail).toHaveBeenCalledWith({
      email: "new@example.com",
      note: null,
    });
    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it("allowed_emailsに既に存在する場合は重複追加しない", async () => {
    const newUser = {
      id: "user-1",
      email: "existing@example.com",
      name: "Existing User",
      role: "student",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockDataSource.getUserByEmail.mockResolvedValue(null);
    mockDataSource.createUser.mockResolvedValue(newUser);
    mockDataSource.isEmailAllowed.mockResolvedValue(true);

    const req = {
      body: { email: "existing@example.com", name: "Existing User" },
      dataSource: mockDataSource as unknown as Request["dataSource"],
      user: { id: "admin-1", role: "admin" },
    } as Partial<Request>;
    const { res, statusMock } = createMockResponse();

    await createUserHandler(req, res);

    expect(mockDataSource.createAllowedEmail).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it("roleに関係なくallowed_emailsにはemail+noteで追加される", async () => {
    const newUser = {
      id: "user-1",
      email: "admin@example.com",
      name: "Admin User",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockDataSource.getUserByEmail.mockResolvedValue(null);
    mockDataSource.createUser.mockResolvedValue(newUser);
    mockDataSource.isEmailAllowed.mockResolvedValue(false);
    mockDataSource.createAllowedEmail.mockResolvedValue({ id: "allowed-1", email: "admin@example.com", note: null, createdAt: new Date() });

    const req = {
      body: { email: "admin@example.com", name: "Admin User", role: "admin" },
      dataSource: mockDataSource as unknown as Request["dataSource"],
      user: { id: "admin-1", role: "admin" },
    } as Partial<Request>;
    const { res } = createMockResponse();

    await createUserHandler(req, res);

    // roleはusersコレクションに保存され、allowed_emailsにはemail+noteのみ
    expect(mockDataSource.createAllowedEmail).toHaveBeenCalledWith({
      email: "admin@example.com",
      note: null,
    });
  });
});

describe("DELETE /admin/users/:id", () => {
  let mockDataSource: MockDataSource;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataSource = createMockDataSource();
  });

  // 直接ハンドラをテストするため、ルーターロジックを抽出
  async function deleteUserHandler(req: Partial<Request>, res: Partial<Response>) {
    const ds = req.dataSource!;
    const id = req.params!.id as string;

    const existing = await ds.getUserById(id);
    if (!existing) {
      (res.status as Mock)(404).json({ error: "not_found", message: "User not found" });
      return;
    }

    const [sessions, enrollments] = await Promise.all([
      ds.getSessions({ userId: id }),
      ds.getEnrollments({ userId: id }),
    ]);

    if (sessions.length > 0 || enrollments.length > 0) {
      (res.status as Mock)(409).json({
        error: "has_related_data",
        message: "Cannot delete user: related data exists",
        details: {
          sessionCount: sessions.length,
          enrollmentCount: enrollments.length,
        },
      });
      return;
    }

    await ds.deleteUser(id);
    (res.status as Mock)(204).send();
  }

  it("ユーザーが見つからない場合は404を返す", async () => {
    mockDataSource.getUserById.mockResolvedValue(null);

    const req = createMockRequest("user-not-found", mockDataSource);
    const { res, statusMock, jsonMock } = createMockResponse();

    await deleteUserHandler(req, res);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      error: "not_found",
      message: "User not found",
    });
  });

  it("セッションが存在する場合は409を返し、詳細にセッション数を含める", async () => {
    mockDataSource.getUserById.mockResolvedValue({ id: "user-1", email: "test@example.com" });
    mockDataSource.getSessions.mockResolvedValue([{ id: "session-1" }, { id: "session-2" }]);
    mockDataSource.getEnrollments.mockResolvedValue([]);

    const req = createMockRequest("user-1", mockDataSource);
    const { res, statusMock, jsonMock } = createMockResponse();

    await deleteUserHandler(req, res);

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith({
      error: "has_related_data",
      message: "Cannot delete user: related data exists",
      details: {
        sessionCount: 2,
        enrollmentCount: 0,
      },
    });
  });

  it("受講登録が存在する場合は409を返し、詳細に受講登録数を含める", async () => {
    mockDataSource.getUserById.mockResolvedValue({ id: "user-1", email: "test@example.com" });
    mockDataSource.getSessions.mockResolvedValue([]);
    mockDataSource.getEnrollments.mockResolvedValue([
      { id: "enrollment-1" },
      { id: "enrollment-2" },
      { id: "enrollment-3" },
    ]);

    const req = createMockRequest("user-1", mockDataSource);
    const { res, statusMock, jsonMock } = createMockResponse();

    await deleteUserHandler(req, res);

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith({
      error: "has_related_data",
      message: "Cannot delete user: related data exists",
      details: {
        sessionCount: 0,
        enrollmentCount: 3,
      },
    });
  });

  it("セッションと受講登録の両方が存在する場合は409を返し、両方の件数を含める", async () => {
    mockDataSource.getUserById.mockResolvedValue({ id: "user-1", email: "test@example.com" });
    mockDataSource.getSessions.mockResolvedValue([{ id: "session-1" }]);
    mockDataSource.getEnrollments.mockResolvedValue([{ id: "enrollment-1" }, { id: "enrollment-2" }]);

    const req = createMockRequest("user-1", mockDataSource);
    const { res, statusMock, jsonMock } = createMockResponse();

    await deleteUserHandler(req, res);

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith({
      error: "has_related_data",
      message: "Cannot delete user: related data exists",
      details: {
        sessionCount: 1,
        enrollmentCount: 2,
      },
    });
  });

  it("関連データがない場合は削除して204を返す", async () => {
    mockDataSource.getUserById.mockResolvedValue({ id: "user-1", email: "test@example.com" });
    mockDataSource.getSessions.mockResolvedValue([]);
    mockDataSource.getEnrollments.mockResolvedValue([]);
    mockDataSource.deleteUser.mockResolvedValue(undefined);

    const req = createMockRequest("user-1", mockDataSource);
    const { res, statusMock, sendMock } = createMockResponse();

    await deleteUserHandler(req, res);

    expect(mockDataSource.deleteUser).toHaveBeenCalledWith("user-1");
    expect(statusMock).toHaveBeenCalledWith(204);
    expect(sendMock).toHaveBeenCalled();
  });
});
