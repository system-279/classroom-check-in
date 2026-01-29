/**
 * セッションフロー統合テスト
 *
 * テスト対象:
 * - check-in → heartbeat → check-out の一連フロー
 * - ADR-0012: 連続INの扱い
 * - ADR-0023: 同時セッション禁止
 *
 * InMemoryDataSourceを使用（Firestore不要）
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import express, { Express } from "express";
import request from "supertest";
import { InMemoryDataSource } from "../../datasource/in-memory.js";
import { createSessionsRouter } from "./helpers/create-routers.js";
import type { User, Course } from "../../types/entities.js";

describe("セッションフロー統合テスト", () => {
  let app: Express;
  let ds: InMemoryDataSource;
  let testUser: User;
  let testCourse: Course;

  beforeEach(async () => {
    // 書き込み可能なInMemoryDataSourceを作成（fake timers前に作成）
    ds = new InMemoryDataSource({ readOnly: false });

    // テスト用ユーザーを作成（デモユーザーとは別）
    testUser = await ds.createUser({
      email: "integration-test@test.com",
      name: "Integration Test Student",
      role: "student",
    });

    // テスト用コースを作成
    testCourse = await ds.createCourse({
      name: "Integration Test Course",
      description: "Test Description",
      classroomUrl: "https://classroom.google.com/integration-test",
      requiredWatchMin: 60,
      enabled: true,
      visible: true,
      note: null,
    });

    // 受講登録
    await ds.createEnrollment({
      courseId: testCourse.id,
      userId: testUser.id,
      role: "student",
      startAt: new Date(),
      endAt: null,
    });

    // Fake timersを設定（データ作成後）
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-29T10:00:00Z"));

    // Expressアプリ作成
    app = express();
    app.use(express.json());

    // テスト用ミドルウェア: DataSourceとユーザーを設定
    app.use((req, _res, next) => {
      req.dataSource = ds;
      req.user = testUser;
      next();
    });

    // セッションルーターをマウント
    const sessionsRouter = createSessionsRouter();
    app.use(sessionsRouter);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("check-in → heartbeat → check-out フロー", () => {
    it("完全なセッションフローを実行できる", async () => {
      // Step 1: check-in (10:00:00)
      const checkInRes = await request(app)
        .post("/sessions/check-in")
        .send({ courseId: testCourse.id });

      expect(checkInRes.status).toBe(201);
      expect(checkInRes.body.session).toBeDefined();
      expect(checkInRes.body.session.status).toBe("open");
      expect(checkInRes.body.isExisting).toBe(false);

      const sessionId = checkInRes.body.session.id;

      // 30分経過
      vi.advanceTimersByTime(30 * 60 * 1000);

      // Step 2: heartbeat (10:30:00)
      const heartbeatRes = await request(app)
        .post(`/sessions/${sessionId}/heartbeat`)
        .send({});

      expect(heartbeatRes.status).toBe(200);
      expect(heartbeatRes.body.session.status).toBe("open");
      expect(heartbeatRes.body.session.lastHeartbeatAt).toBeDefined();

      // さらに30分経過
      vi.advanceTimersByTime(30 * 60 * 1000);

      // Step 3: check-out (11:00:00) - 1時間経過
      const checkOutRes = await request(app)
        .post(`/sessions/${sessionId}/check-out`)
        .send({});

      expect(checkOutRes.status).toBe(200);
      expect(checkOutRes.body.session.status).toBe("closed");
      expect(checkOutRes.body.session.endTime).toBeDefined();
      expect(checkOutRes.body.session.durationSec).toBe(3600); // 1時間 = 3600秒
    });

    it("アクティブセッションを取得できる", async () => {
      // check-in前はnull（テストユーザーのセッションのみ確認）
      const beforeRes = await request(app).get("/sessions/active");
      expect(beforeRes.status).toBe(200);
      // 注: デモデータに他ユーザーのopenセッションがあるが、testUserのものはない
      expect(beforeRes.body.session).toBeNull();

      // check-in
      await request(app)
        .post("/sessions/check-in")
        .send({ courseId: testCourse.id });

      // check-in後はセッションを取得
      const afterRes = await request(app).get("/sessions/active");
      expect(afterRes.status).toBe(200);
      expect(afterRes.body.session).not.toBeNull();
      expect(afterRes.body.session.status).toBe("open");
    });
  });

  describe("ADR-0012: 連続INの扱い", () => {
    it("同一講座への連続INは既存セッションを返す", async () => {
      // 1回目のcheck-in
      const firstRes = await request(app)
        .post("/sessions/check-in")
        .send({ courseId: testCourse.id });

      expect(firstRes.status).toBe(201);
      expect(firstRes.body.isExisting).toBe(false);
      const firstSessionId = firstRes.body.session.id;

      // 2回目のcheck-in（同一講座）
      const secondRes = await request(app)
        .post("/sessions/check-in")
        .send({ courseId: testCourse.id });

      expect(secondRes.status).toBe(200); // 既存なので200
      expect(secondRes.body.isExisting).toBe(true);
      expect(secondRes.body.session.id).toBe(firstSessionId);
    });
  });

  describe("ADR-0023: 同時セッション禁止", () => {
    it("別講座でINを試みると409エラー", async () => {
      // 2つ目のコースを作成
      const anotherCourse = await ds.createCourse({
        name: "Another Integration Test Course",
        description: "Another Description",
        classroomUrl: "https://classroom.google.com/another-integration",
        requiredWatchMin: 60,
        enabled: true,
        visible: true,
        note: null,
      });

      // 2つ目のコースにも受講登録（testUserに）
      await ds.createEnrollment({
        courseId: anotherCourse.id,
        userId: testUser.id,
        role: "student",
        startAt: new Date(),
        endAt: null,
      });

      // 1つ目の講座でcheck-in
      const firstRes = await request(app)
        .post("/sessions/check-in")
        .send({ courseId: testCourse.id });

      expect(firstRes.status).toBe(201);

      // 別講座でcheck-in試行 → 409エラー
      const secondRes = await request(app)
        .post("/sessions/check-in")
        .send({ courseId: anotherCourse.id });

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.error).toBe("session_conflict");
      expect(secondRes.body.existingSession).toBeDefined();
    });
  });

  describe("エラーケース", () => {
    it("未登録講座へのcheck-inは403", async () => {
      // 受講登録のない講座を作成（testUserは登録しない）
      const notEnrolledCourse = await ds.createCourse({
        name: "Not Enrolled Integration Course",
        description: "Test",
        classroomUrl: "https://classroom.google.com/not-enrolled-integration",
        requiredWatchMin: 60,
        enabled: true,
        visible: true,
        note: null,
      });

      const res = await request(app)
        .post("/sessions/check-in")
        .send({ courseId: notEnrolledCourse.id });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("not_enrolled");
    });

    it("存在しないセッションへのheartbeatは404", async () => {
      const res = await request(app)
        .post("/sessions/non-existent/heartbeat")
        .send({});

      expect(res.status).toBe(404);
    });

    it("クローズ済みセッションへのcheck-outは400", async () => {
      // check-in（beforeEachで作成したtestCourseを使用）
      const checkInRes = await request(app)
        .post("/sessions/check-in")
        .send({ courseId: testCourse.id });

      const sessionId = checkInRes.body.session.id;

      // check-out（1回目）
      await request(app).post(`/sessions/${sessionId}/check-out`).send({});

      // check-out（2回目）→ エラー
      const res = await request(app)
        .post(`/sessions/${sessionId}/check-out`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("session_already_closed");
    });
  });
});
