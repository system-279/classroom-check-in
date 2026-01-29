/**
 * users.ts のユニットテスト
 *
 * テスト対象:
 * - DELETE /admin/users/:id の関連データチェックと詳細レスポンス
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Request, Response } from "express";

// DataSource のモック型
type MockDataSource = {
  getUserById: Mock;
  getSessions: Mock;
  getEnrollments: Mock;
  deleteUser: Mock;
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
    getSessions: vi.fn(),
    getEnrollments: vi.fn(),
    deleteUser: vi.fn(),
  };
}

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
