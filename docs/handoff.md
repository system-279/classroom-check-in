# Handoff

## 目的
- このドキュメントは、初見のAI/開発者がスムーズに引き継げるように現状を要約する。
- ドキュメントと実装が一致することを最優先とする。

## 現状の結論
- Classroomの入退室ログはAPIで直接取得不可。
- 入退室は自社アプリでIN/OUTボタンを提供し、ClassroomのコースURLへ遷移する方式。
- **Classroom API / Forms API連携は廃止**（OAuth審査コストが高いため）。
- **講座・受講者情報は管理画面で手入力**。
- **OAuth認証は実装しない**（ADR-0014）。
- **動画プレイヤー連携は実装しない**（ADR-0015）。IN/OUTは手動入力のみ。

## 重要な決定（ADR）
- 参照: `docs/decisions.md`
- 主要ポイント:
  - Cloud Run中心 + Firestore/BigQuery + Scheduler
  - 連続INは既存openセッションを返す
  - **Classroom API連携は廃止**（ADR-0006, ADR-0008, ADR-0013改訂）
  - **Forms API連携は廃止**（ADR-0005改訂）
  - **OAuth認証は実装しない**（ADR-0014）
  - **動画プレイヤー連携は実装しない**（ADR-0015）

## 技術スタック（安定版）
- 参照: `docs/tech-stack.md`
- Node.js LTS v24.12.0
- Next.js 16.1.1 / React 19.2.3 / TypeScript 5.9.3
- Express 5.2.1

## リポジトリ構成
- 参照: `docs/repo-structure.md`
- `services/api`: REST API (Cloud Run)
- `services/notification`: 通知送信 (Cloud Run)
- `web`: Next.js (受講者/管理画面)

**削除済み**:
- ~~`services/ingestion`~~: Classroom/Forms連携廃止のため
- ~~`services/event-collector`~~: 動画プレイヤー連携廃止のため（ADR-0015）
- ~~`services/session`~~: 動画プレイヤー連携廃止のため（ADR-0015）

## 実装済み範囲
- APIの主要エンドポイント: `services/api/src/index.ts`
  - `/api/v1/courses`（N+1解消済み: 講座一覧とセッションを並列取得）
  - `/api/v1/sessions/active|check-in|heartbeat|check-out`
    - check-in: Firestoreトランザクションで排他制御（同時リクエスト対応）
    - check-out: durationSec負値防止（Math.max(0, ...)）
  - `/api/v1/admin/courses`
  - `/api/v1/admin/users` - ユーザー管理（CRUD）
  - `/api/v1/admin/users/:id/settings` - ユーザー設定管理
  - `/api/v1/admin/enrollments` - 受講登録管理
  - `/api/v1/admin/sessions` - セッション一覧・強制終了
  - `/api/v1/admin/notification-policies` - 通知ポリシー管理
- 認証は `AUTH_MODE=dev` でヘッダ疑似認証
- GCPプロジェクト: `classroom-checkin-279`（Firestore, Cloud Run等有効化済み）
- **管理画面UI**: `web/app/admin/`
  - 講座管理（一覧・作成・編集・削除）
  - 受講者管理（一覧・作成・編集・削除・講座登録）
  - セッション管理（一覧・フィルタ・強制終了）
  - 通知ポリシー管理（スコープ別設定）
  - Tailwind CSS v4 + shadcn/ui
- **受講者向けUI**: `web/app/student/`
  - 講座一覧（`/student/courses`）
    - 受講時の注意事項表示（同時並行禁止、分割視聴禁止、倍速禁止）
  - セッションページ（`/student/session/[courseId]`）
    - IN/OUTボタン
    - 入室前確認事項表示
    - 経過時間タイマー
    - heartbeat（1分間隔）
    - Classroom新規タブ遷移
- **講座設定**:
  - 必要視聴時間（`requiredWatchMin`）: 講座ごとに設定可能、デフォルト63分
- **通知サービス**: `services/notification/src/`
  - **マルチテナント対応済み**（全アクティブテナントを走査）
  - OUT忘れセッション検出（lastHeartbeatAtベース）
  - 通知ポリシー解決（user > course > global）
  - Gmail API / コンソール出力対応
  - 通知ログ記録・重複防止
  - コレクション名: `notification_policies`, `notification_logs`, `user_settings`（snake_case統一）
- **Cloud Scheduler設定済み**:
  - 通知サービス: `notification-job`（毎時0分実行）
- **Cloud Runデプロイ済み**:
  - API: https://api-102013220292.asia-northeast1.run.app
  - Web UI: https://web-102013220292.asia-northeast1.run.app
  - Notification: https://notification-102013220292.asia-northeast1.run.app
- Artifact Registry クリーンアップポリシー（最新2イメージ保持）
- **運用監視設定済み**:
  - Uptime Check（API/Web/Notification、5分間隔）
  - アラートポリシー（Uptime失敗時にメール通知）
  - 夜間スモークテスト（GitHub Actions、毎日AM 3:00 JST）
  - 運用チェックリスト: `docs/ops-checklist.md`
- **Firestoreインデックス設定済み**:
  - sessions: status + startTime（複合インデックス）

## 環境変数
- 参照: `docs/config.md`
- `AUTH_MODE=dev` で `X-User-Id` / `X-User-Role` が有効
- `GOOGLE_APPLICATION_CREDENTIALS` はGCP接続に必要

## API仕様
- 参照: `docs/api.md`
- 注意点:
  - `enabled=false` の場合は `visible` を自動で false に補正
  - `GET /courses` は enabled=true かつ visible=true のみ返す
  - Timestamp型はすべてISO 8601文字列で返される

## データモデル
- 参照: `docs/data-model.md`
- 主要コレクション: `courses`, `sessions`, `attendanceEvents`, `enrollments`, `users`, `userSettings`, `notificationPolicies`, `notificationLogs`
- 廃止済み: ~~`courseTargets`~~（Courseに統合）, ~~`formMappings`~~, ~~`formResponses`~~, ~~`syncRuns`~~, ~~`videoWatchEvents`~~, ~~`videoWatchSessions`~~

## GCP設定済み
- プロジェクト: `classroom-checkin-279`
- リージョン: asia-northeast1
- Firestore: Native mode
- サービスアカウント: `classroom-sync@classroom-checkin-279.iam.gserviceaccount.com`
- キー: `.secrets/classroom-sync-key.json`

## スコープ外（実装予定なし）
- OAuth認証（ADR-0014）
- 動画プレイヤー連携（ADR-0015）
- Classroom API連携
- Forms API連携

## 最新セッション成果（2026-01-29）

### データとフロントの紐づけ問題修正

**解決した問題**:
1. **Reactハイドレーションエラー #418**: AuthProvider の二重ネスティングを修正
2. **受講者画面に講座が表示されない**: スーパー管理者のテナントユーザー優先ロジックを修正
3. **受講講座ダイアログUX改善**: 一括削除機能、ダイアログ自動クローズ問題を修正
4. **ナビゲーション表示修正**: ページコンテキストに応じた適切なリンク表示
5. **ユーザー削除エラーUX改善**: 関連データの詳細（セッション数、受講登録数）を表示

**主要PR**:
- PR #20-#23: ハイドレーションエラー修正
- PR #24: 受講講座の一括解除機能
- PR #25: ダイアログ自動クローズ問題修正
- PR #26: スーパー管理者テナントユーザー優先修正
- PR #27: tenant-auth.ts ユニットテスト追加
- PR #28: ユーザー削除エンドポイント ユニットテスト追加

**テスト追加**:
- `services/api/src/middleware/tenant-auth.test.ts` (8テスト)
- `services/api/src/routes/shared/users.test.ts` (5テスト)

**変更ファイル**:
- `web/app/[tenant]/layout.tsx` - AuthProvider重複削除、ナビゲーション改善
- `web/lib/auth-context.tsx` - TenantContextからisDemo取得
- `services/api/src/middleware/tenant-auth.ts` - テナントユーザー優先ロジック
- `services/api/src/routes/shared/users.ts` - 削除エラー詳細レスポンス
- `web/lib/api.ts` - ApiError.details追加
- `web/app/admin/users/_components/delete-confirm-dialog.tsx` - 詳細エラー表示

---

## 前回セッション成果（2026-01-27 #2）

### スーパー管理者機能の強化
システム全体を管理するスーパー管理者機能を大幅に拡張。

**新機能**:
1. **テナント一覧にリンク追加**
   - 各テナントの「管理」「受講」ボタンを追加
   - 新規タブで各テナントの画面を開ける

2. **スーパー管理者のUI管理**（`/super-admin/admins`）
   - Firestoreベースのスーパー管理者管理
   - 環境変数に加え、UIからも管理者を追加・削除可能
   - 環境変数リセット時もFirestoreから復元可能
   - API: `GET/POST/DELETE /api/v2/super/admins`

3. **スーパー管理者の全テナントアクセス**
   - 許可リストに関係なく全テナントにアクセス可能
   - テナント内では管理者（admin）権限として扱われる
   - 「スーパー管理者としてアクセス中」バナー表示

4. **CD設定改善**
   - GitHub Secretsに `SUPER_ADMIN_EMAILS` 設定
   - デプロイ時に自動設定されるように修正

**関連ファイル**:
- `services/api/src/middleware/super-admin.ts` - Firestore管理対応
- `services/api/src/middleware/tenant-auth.ts` - スーパー管理者バイパス
- `services/api/src/routes/super-admin.ts` - 管理者管理API追加
- `web/app/super-admin/admins/page.tsx` - 管理者管理UI
- `web/app/[tenant]/layout.tsx` - スーパー管理者バナー
- `.github/workflows/deploy.yml` - SUPER_ADMIN_EMAILS対応

---

## 前回セッション成果（2026-01-27）

### テナント登録完了画面と受講者リンク共有UI（PR #17）
テナント作成後のUXを改善。管理者が受講者にリンクを共有しやすくした。

**API変更**:
- `POST /api/v2/tenants` レスポンスに `studentUrl` フィールドを追加

**Web UI変更**:
- テナント登録完了画面: 登録成功後に管理者/受講者リンクを表示
  - コピーボタンでURLをクリップボードにコピー
  - 「次のステップ」ガイダンスを表示
- 管理画面ダッシュボード: 受講者向けリンク共有セクションを追加
  - `/{tenantId}/student` URLを目立つ位置に表示
  - ワンクリックでコピー可能

---

## 過去セッション成果（2026-01-21）

### セッション管理の残論点解決
すべての残論点を解決し、実装を完了。

| ADR | タイトル | 決定内容 |
|-----|---------|---------|
| ADR-0020 | OUT欠損セッション自動確定 | 48時間経過で自動クローズ |
| ADR-0021 | タブ閉鎖検知 | スコープ外（ブラウザ制約） |
| ADR-0022 | Heartbeat継続方式 | setInterval方式維持 |
| ADR-0023 | 同時複数講座セッション | 1人1セッションのみ許可 |

**実装内容**:
- `services/notification/src/services/auto-closer.ts` - 48時間自動クローズ
- `services/api/src/routes/shared/sessions.ts` - 同時セッション禁止

### AlertBox共有コンポーネント
- `web/components/ui/alert-box.tsx` - DRY原則に準拠した共有コンポーネント
- Tailwind v4 `@source`ディレクティブ問題を解決

### 残論点の状態
- `docs/open-questions.md` → **すべて解決済み**

## 前回セッション成果（2026-01-20）

### 退室打刻の必要視聴時間チェック（PR #16）
必要視聴時間（requiredWatchMin）経過前の退室を防止する機能。

- **API**: `POST /sessions/check-out`
  - requiredWatchMin経過チェックを追加
  - 未達の場合は400エラー（`not_enough_time`）
  - レスポンスに `requiredWatchMin`, `elapsedSec`, `remainingSec` を含む
- **Web UI**: `/[tenant]/student/session/[courseId]`
  - プログレスバーで進捗を可視化
  - 残り時間をリアルタイム表示
  - 達成時は「✓ 必要視聴時間に達しました」を表示
  - 未達時は退室ボタンを非活性化+注意文表示

### セルフチェックアウト機能（PR #15）
OUT忘れ通知を受け取った受講者が、自分で退室時刻を指定して打刻できる機能。

- **API**:
  - `GET /sessions/self-checkout/:sessionId/info` - セッション情報取得
  - `POST /sessions/self-checkout` - 退室時刻を指定して打刻
- **Web UI**: `/[tenant]/student/checkout/[sessionId]`
- **通知メール**: チェックアウトURLを追加

**バリデーション条件**:
- 本人のセッションであること
- セッションがopen状態であること
- 通知が送信済みであること
- 入室からrequiredWatchMin経過していること
- 退室時刻が有効範囲内であること

### Codexレビュー修正（PR #14, #15）

| 優先度 | 問題 | 対応 |
|--------|------|------|
| High | user_settings スキーマ不整合 | 通知サービスのスキーマをAPI側に統一 |
| High | 受講登録なしでcheck-in可能 | check-inエンドポイントで受講登録を検証 |
| High | stale検出がグローバルポリシーのみ | ポリシー単位でstale判定する方式に変更 |
| Medium | 関連データありでuser/course削除可能 | 削除前にセッション・受講登録の有無を確認 |
| Medium | 講座一覧が受講登録でフィルタされない | 受講登録済みの講座のみを返すように修正 |
| Medium | 通知ポリシーの重複作成可能 | 重複チェックを追加（409エラー） |

## 開発メモ
- ドキュメント更新の順序は `docs/ai-dev-guide.md` を参照
- ドキュメントと実装がズレたら必ず修正する
- ローカル開発: APIは`npm run start -w @classroom-check-in/api`、Webは`npm run dev -w @classroom-check-in/web`
