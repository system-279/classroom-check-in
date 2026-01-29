/**
 * DataSource ファクトリのユニットテスト
 *
 * テスト対象:
 * - デモモードでInMemoryDataSourceを返す
 * - 本番モードでFirestoreDataSourceを返す
 * - tenantId未指定時のエラー
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.hoistedでモッククラスを定義
const MockFirestore = vi.hoisted(() => {
  return vi.fn().mockImplementation(function () {
    return {
      collection: vi.fn(),
    };
  });
});

// Firestoreをモック
vi.mock("@google-cloud/firestore", () => {
  return {
    Firestore: MockFirestore,
  };
});

// モジュールを動的にインポート（モック後）
const { getDataSource, getDefaultDataSource } = await import("./factory.js");
const { InMemoryDataSource } = await import("./in-memory.js");
const { FirestoreDataSource } = await import("./firestore.js");

describe("DataSource Factory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getDataSource", () => {
    it("デモモードでInMemoryDataSourceを返す", () => {
      const ds = getDataSource({ tenantId: "", isDemo: true });
      expect(ds).toBeInstanceOf(InMemoryDataSource);
    });

    it("デモモードではtenantIdは不要", () => {
      const ds = getDataSource({ tenantId: "", isDemo: true });
      expect(ds).toBeDefined();
    });

    it("本番モードでFirestoreDataSourceを返す", () => {
      const ds = getDataSource({ tenantId: "test-tenant", isDemo: false });
      expect(ds).toBeInstanceOf(FirestoreDataSource);
    });

    it("本番モードでtenantId未指定はエラー", () => {
      expect(() => getDataSource({ tenantId: "", isDemo: false })).toThrow(
        "tenantId is required for non-demo DataSource"
      );
    });
  });

  describe("getDefaultDataSource", () => {
    it("FirestoreDataSourceを返す（レガシー用）", () => {
      const ds = getDefaultDataSource();
      expect(ds).toBeInstanceOf(FirestoreDataSource);
    });
  });
});
