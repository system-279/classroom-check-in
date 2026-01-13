# Handoff

## 目的
- このドキュメントは、初見のAI/開発者がスムーズに引き継げるように現状を要約する。
- ドキュメントと実装が一致することを最優先とする。

## 現状の結論
- Classroomの入退室ログはAPIで直接取得不可。
- 入退室は自社アプリでIN/OUTボタンを提供し、ClassroomのコースURLへ遷移する方式。
- 講座一覧は Classroom API でドメイン全体を同期し、管理画面で対象講座/表示を制御。
- Forms提出時刻はOUT補助として取得可能（Forms API）。
- 動画視聴の厳密判定はアプリ内プレイヤー前提。

## 重要な決定（ADR）
- 参照: `docs/decisions.md`
- 主要ポイント:
  - Cloud Run中心 + Firestore/BigQuery + Scheduler/Tasks
  - 連続INは既存openセッションを返す
  - Classroom同期はドメイン全体取得 + Course IDで対象指定
  - FormsのForm IDは管理画面で手動登録

## 技術スタック（安定版）
- 参照: `docs/tech-stack.md`
- Node.js LTS v24.12.0
- Next.js 16.1.1 / React 19.2.3 / TypeScript 5.9.3
- Express 5.2.1

## リポジトリ構成
- 参照: `docs/repo-structure.md`
- `services/api`: REST API (Cloud Run)
- `services/ingestion`: Classroom/Forms同期バッチ (Cloud Run)
- `services/event-collector`: 動画イベント収集 (Cloud Run)
- `services/session`: セッション再計算 (Cloud Run)
- `services/notification`: 通知送信 (Cloud Run)
- `web`: Next.js (受講者/管理画面)

## 実装済み範囲（GCP接続前まで）
- APIの主要エンドポイント: `services/api/src/index.ts`
  - `/api/v1/courses`
  - `/api/v1/sessions/check-in|heartbeat|check-out`
  - `/api/v1/admin/courses`
  - `/api/v1/admin/course-targets`
- Classroom/Forms同期ロジック: `services/ingestion/src/tasks/*.ts`
- 認証は `AUTH_MODE=dev` でヘッダ疑似認証
- GCP未接続。同期実行時は資格情報が必要

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
- FirestoreのドキュメントIDは外部IDを使う方針
- 主要コレクション: `courses`, `courseTargets`, `sessions`, `attendanceEvents`, `enrollments`, `users`, `formMappings`, `formResponses`, `syncRuns`

## GCP接続が必要なポイント
- `services/ingestion` の `/run`
  - Classroom/Forms同期実行
  - ドメインワイドデリゲーションが必要な場合あり

## 未実装/未確定
- OAuth実装（Googleログイン）
- 管理画面のUIとAPI接続
- 通知送信の実装（SendGrid/Gmail/SMTP）
- セッション再計算ジョブ
- 動画視聴トラッキングの実装

## 次の優先タスク（推奨順）
1) Classroom同期の実運用設定（GCPプロジェクト作成 + DWD設定）
2) OAuthログインとセッション管理
3) 管理画面（Course ID登録/visible切替/同期状態）
4) 通知サービスとOUT忘れ通知

## 開発メモ
- ドキュメント更新の順序は `docs/ai-dev-guide.md` を参照
- ドキュメントと実装がズレたら必ず修正する
