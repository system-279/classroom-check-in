import cors from "cors";
import express from "express";
import { initializeApp, getApps } from "firebase-admin/app";
import { tenantAwareAuthMiddleware } from "./middleware/tenant-auth.js";
import {
  tenantMiddleware,
  demoAuthMiddleware,
  demoReadOnlyMiddleware,
  dataSourceErrorHandler,
} from "./middleware/tenant.js";
import { createSharedRouter } from "./routes/shared/index.js";
import { tenantsRouter } from "./routes/tenants.js";
import { superAdminRouter } from "./routes/super-admin.js";

// Firebase Admin初期化（エミュレータ対応）
const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || "classroom-checkin-279";
if (getApps().length === 0) {
  initializeApp({ projectId });
  console.log(`Firebase Admin initialized with projectId: ${projectId}`);
}

const app = express();

// CORS設定: 本番環境ではCORS_ORIGINの設定を必須とする
const corsOrigins = process.env.CORS_ORIGIN?.split(",");
if (!corsOrigins && process.env.NODE_ENV === "production") {
  throw new Error("CORS_ORIGIN must be set in production");
}
app.use(cors({
  origin: corsOrigins ?? ["http://localhost:3000", "http://localhost:3001"],
  credentials: true,
}));
app.use(express.json());

// リクエストログミドルウェア（デバッグ用）
app.use((req, _res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// デモモード設定（環境変数で制御）
const DEMO_ENABLED = process.env.DEMO_ENABLED === "true";

// ヘルスチェック（認証不要）
// 複数パスで提供（/healthzはGCPで予約されている可能性があるため）
app.get(["/health", "/healthz", "/api/health"], (_req, res) => {
  res.json({ status: "ok" });
});

// ========================================
// ルーターのマウント
// ========================================

// テナント登録API（認証のみ、テナントコンテキスト不要）
// POST /api/v2/tenants - 新規テナント作成
// GET /api/v2/tenants/mine - 自分のテナント一覧
app.use("/api/v2/tenants", tenantsRouter);

// スーパー管理者API（SUPER_ADMIN_EMAILSで認可）
// GET /api/v2/super/tenants - 全テナント一覧
// GET /api/v2/super/tenants/:id - テナント詳細
// PATCH /api/v2/super/tenants/:id - テナント更新
app.use("/api/v2/super", superAdminRouter);

// URL: /api/v2/:tenant/*
// - /api/v2/demo/* → デモモード（読み取り専用、モックデータ）
// - /api/v2/{tenantId}/* → 本番モード（Firestore）
app.use(
  "/api/v2/:tenant",
  tenantMiddleware,            // テナントコンテキスト設定
  demoAuthMiddleware,          // デモ用固定ユーザー設定
  tenantAwareAuthMiddleware,   // テナント対応認証（DataSource使用）
  demoReadOnlyMiddleware,      // デモ用読み取り専用制限
  createSharedRouter()         // 共通ルーター
);

// DataSourceエラーハンドラ
app.use(dataSourceErrorHandler);

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`API service listening on :${port}`);
  console.log("Routes:");
  console.log("  - /health, /healthz, /api/health (health check)");
  console.log("  - /api/v2/tenants (tenant registration)");
  console.log("  - /api/v2/super/* (super admin API)");
  console.log("  - /api/v2/:tenant/* (tenant-based API)");
  if (DEMO_ENABLED) {
    console.log("  - /api/v2/demo/* (demo mode)");
  }
});
