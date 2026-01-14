# Handoff

## 目的
- このドキュメントは、初見のAI/開発者がスムーズに引き継げるように現状を要約する。
- ドキュメントと実装が一致することを最優先とする。

## 現状の結論
- Classroomの入退室ログはAPIで直接取得不可。
- 入退室は自社アプリでIN/OUTボタンを提供し、ClassroomのコースURLへ遷移する方式。
- **Classroom API / Forms API連携は廃止**（OAuth審査コストが高いため）。
- **講座・受講者情報は管理画面で手入力**。
- 動画視聴の厳密判定はアプリ内プレイヤー前提。

## 重要な決定（ADR）
- 参照: `docs/decisions.md`
- 主要ポイント:
  - Cloud Run中心 + Firestore/BigQuery + Scheduler/Tasks
  - 連続INは既存openセッションを返す
  - **Classroom API連携は廃止**（ADR-0006, ADR-0008, ADR-0013改訂）
  - **Forms API連携は廃止**（ADR-0005改訂）
  - **講座・受講者は管理画面で手入力**

## 技術スタック（安定版）
- 参照: `docs/tech-stack.md`
- Node.js LTS v24.12.0
- Next.js 16.1.1 / React 19.2.3 / TypeScript 5.9.3
- Express 5.2.1

## リポジトリ構成
- 参照: `docs/repo-structure.md`
- `services/api`: REST API (Cloud Run)
- ~~`services/ingestion`~~: **廃止**（Classroom/Forms連携廃止のため）
- `services/event-collector`: 動画イベント収集 (Cloud Run)
- `services/session`: セッション再計算 (Cloud Run)
- `services/notification`: 通知送信 (Cloud Run)
- `web`: Next.js (受講者/管理画面)

## 実装済み範囲
- APIの主要エンドポイント: `services/api/src/index.ts`
  - `/api/v1/courses`
  - `/api/v1/sessions/check-in|heartbeat|check-out`
  - `/api/v1/admin/courses`
  - `/api/v1/admin/users` - ユーザー管理（CRUD）
  - `/api/v1/admin/enrollments` - 受講登録管理
  - `/api/v1/admin/sessions` - セッション一覧・強制終了
- 認証は `AUTH_MODE=dev` でヘッダ疑似認証
- GCPプロジェクト: `classroom-checkin-279`（Firestore, Cloud Run等有効化済み）
- **管理画面UI**: `web/app/admin/`
  - 講座管理（一覧・作成・編集・削除）
  - 受講者管理（一覧・作成・編集・削除・講座登録）
  - セッション管理（一覧・フィルタ・強制終了）
  - Tailwind CSS v4 + shadcn/ui
- **受講者向けUI**: `web/app/student/`
  - 講座一覧（`/student/courses`）
  - セッションページ（`/student/session/[courseId]`）
    - IN/OUTボタン
    - 経過時間タイマー
    - heartbeat（1分間隔）
    - Classroom新規タブ遷移

## 環境変数
- 参照: `docs/config.md`
- `AUTH_MODE=dev` で `X-User-Id` / `X-User-Role` が有効
- `GOOGLE_APPLICATION_CREDENTIALS` と `GOOGLE_WORKSPACE_ADMIN_SUBJECT` はGCP接続後に設定

## API仕様
- 参照: `docs/api.md`
- 注意点:
  - `enabled=false` の場合は `visible` を自動で false に補正
  - `GET /courses` は enabled=true かつ visible=true のみ返す

## データモデル
- 参照: `docs/data-model.md`
- 主要コレクション: `courses`, `sessions`, `attendanceEvents`, `enrollments`, `users`
- 廃止済み: ~~`courseTargets`~~（Courseに統合）, ~~`formMappings`~~, ~~`formResponses`~~, ~~`syncRuns`~~

## GCP設定済み
- プロジェクト: `classroom-checkin-279`
- リージョン: asia-northeast1
- Firestore: Native mode
- サービスアカウント: `classroom-sync@classroom-checkin-279.iam.gserviceaccount.com`
- キー: `.secrets/classroom-sync-key.json`

## 未実装/未確定
- 認証方式（OAuth審査が必要なため後日検討）
- 通知送信の実装（SendGrid/Gmail/SMTP）
- セッション再計算ジョブ
- 動画視聴トラッキングの実装

## 次の優先タスク（推奨順）
1) 通知サービスとOUT忘れ通知
2) 認証方式の検討（OAuth審査 or 別方式）
3) 動画視聴トラッキング
4) セッション再計算ジョブ

## 開発メモ
- ドキュメント更新の順序は `docs/ai-dev-guide.md` を参照
- ドキュメントと実装がズレたら必ず修正する
