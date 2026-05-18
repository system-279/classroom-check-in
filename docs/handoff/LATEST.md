# Classroom Check-in Handoff

最終更新: 2026-05-19 JST

## 現在のフェーズ

**本番運用中 - 機能完成・安定稼働フェーズ**

## 直近の変更履歴

| 日付 | コミット | 内容 |
|------|----------|------|
| 2026-05-19 | PR #41 | 受講者ログイン状態確認用 workflow_dispatch ツール追加（ADR-0028） |
| 2026-03-08 | PR #40 | ログイン画面からデモリンク削除、E2Eテストを/demoページに変更 |
| 2026-03-08 | PR #39 | Smoke Testコールドスタート対策（タイムアウト延長+ウォームアップ）+lint設定修正 |
| 2026-03-08 | PR #37 | 未ログイン画面にデモリンクを追加（Nightly Smoke Test修正） |
| 2026-02-14 | PR #36 | スーパー管理者テナント削除機能追加、ログイン画面リンク整理 |
| 2026-02-14 | PR #35 | レガシールート・API削除、テナントURL未認証リダイレクト修正 |

## MVP実装状況

| 機能 | 状態 | 備考 |
|------|------|------|
| 入退室打刻 | ✅完了 | IN/OUT、heartbeat |
| 管理画面 | ✅完了 | 講座・受講者・セッション・通知ポリシー管理 |
| 受講者画面 | ✅完了 | 講座一覧、セッションタイマー |
| Firebase認証 | ✅完了 | Googleソーシャルログイン |
| マルチテナント | ✅完了 | URLパスプレフィックス分離 |
| テナント登録 | ✅完了 | セルフサービス |
| スーパー管理者 | ✅完了 | 全テナント管理 |
| OUT忘れ通知 | ✅完了 | 通知サービス、Cloud Scheduler |
| セルフチェックアウト | ✅完了 | 受講者が退室時刻を指定 |
| 再入室禁止 | ✅完了 | 同一講座への再入室ブロック |
| デモモード | ✅完了 | 読み取り専用 |
| ログイン障害調査ツール | ✅完了 | workflow_dispatch、ADR-0028 |

## 次のアクション候補

1. **新機能検討** - 運用フィードバックに基づく改善
2. **typo 検出スクリプト拡張**（任意） - `check-user-status` に「ドメイン部分一致」「ローカル部分一致」モード追加で typo 候補を自動検出

## デプロイ済みインフラ

| サービス | URL |
|----------|-----|
| API | https://api-102013220292.asia-northeast1.run.app |
| Web | https://web-102013220292.asia-northeast1.run.app |
| Notification | https://notification-102013220292.asia-northeast1.run.app |
| Docs | https://system-279.github.io/classroom-check-in/ |

## 運用ツール

| ツール | 起動経路 | 用途 |
|------|----------|------|
| Check User Login Status | GitHub Actions → workflow_dispatch | 受講者ログイン障害時、全テナント横断で `allowed_emails` / `users` 登録状況確認（ADR-0028） |
| Nightly Smoke Test | Cron (毎日) | デモ画面のE2E動作確認 |
| Deploy to Cloud Run | main push 時自動 | api / web / notification の自動デプロイ |

## CI Service Account 権限

`github-actions@classroom-checkin-279.iam.gserviceaccount.com`:

- roles/artifactregistry.writer
- roles/datastore.indexAdmin
- **roles/datastore.viewer** （2026-05-19 追加、ADR-0028）
- roles/run.admin
- roles/serviceusage.serviceUsageConsumer

## テスト状況

| サービス | テスト数 | 状態 |
|----------|----------|------|
| API | 314件 | ✅Pass |
| Notification | 20件 | ✅Pass |
| E2E（マルチテナント） | 5件 | ✅Pass |
| Nightly Smoke Test | 9件 | ✅Pass |
| 合計 | 348件 | ✅Pass |

## 今回のセッション詳細（2026-05-19）

### 完了した作業

✅ **受講者ログイン障害調査ツール追加（PR #41, ADR-0028）**
- 福の種様より「2名がログインできない」問い合わせを起点に、本番 Firestore 確認手順を恒久化
- workflow_dispatch + CI SA（Workload Identity Federation）で全テナント横断検索
- 出力規範: PII 最小化（メアドとテナント名/ID は出力可、ユーザー名/firebaseUid は出さない）
- セーフガード: email 形式バリデーション・重複排除・20件上限・workflow timeout 5分
- Codex review で指摘の4点（tsx 固定/timeout/email validation/JSON エスケープ）を反映後マージ

✅ **CI Service Account に roles/datastore.viewer 付与**
- 既存 CI SA `github-actions@classroom-checkin-279.iam.gserviceaccount.com` に read-only 権限付与
- 番号単位の明示認可後に実行、不要時は `gcloud projects remove-iam-policy-binding` で即時剥奪可

✅ **福の種様問い合わせ調査**
- 対象2名（`y-mizuno@fuku-no-tane.com`, `c-yazawa@fuku-no-tane.com`）を全7テナント横断検索
- 結果: いずれのテナントの `allowed_emails` / `users` にも未登録
- 管理者目視（テナント `t9e6gvio` 受講者管理画面）でも未登録を確認
- 福の種様への返信は管理者側の登録漏れ / 表記揺れの確認を依頼する形でクローズ

### システム状態
✅ CI: Lint/TypeCheck/Build 全pass
✅ 本番デプロイ: 影響なし（コード追加のみ、ランタイム挙動変化なし）
✅ Nightly Smoke Test: 直近1m26s で成功
✅ 再開可能（コード品質・テスト・ドキュメント整合性確認済み）
