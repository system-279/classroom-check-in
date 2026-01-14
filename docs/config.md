# 環境変数・設定

## 共通
- `FIRESTORE_PROJECT_ID`:
  - FirestoreのプロジェクトID（未設定なら `GCLOUD_PROJECT` / `GOOGLE_CLOUD_PROJECT` を参照）
- `GOOGLE_APPLICATION_CREDENTIALS`:
  - サービスアカウントJSONのパス

## API Service (`services/api`)
- `AUTH_MODE`:
  - `dev` ならヘッダ疑似認証が有効
  - `dev` 以外はOAuth実装が必要
- `PORT` (default: 8080)
- `CORS_ORIGIN`:
  - 本番環境では必須（カンマ区切りで複数指定可能）

## Notification Service (`services/notification`)
- `PORT` (default: 8080)
- `MAIL_PROVIDER`:
  - `gmail` または `console`（デフォルト: `console`）
- `MAIL_FROM`:
  - 送信元メールアドレス（デフォルト: `noreply@example.com`）
- `GMAIL_DELEGATE_USER`:
  - Gmail APIを使う場合の委任先メールアドレス
  - ドメインワイドデリゲーション設定が必要

## Event Collector Service (`services/event-collector`)
- `PORT` (default: 8080)

## Session Service (`services/session`)
- `PORT` (default: 8080)

---

# Cloud Runデプロイ設定

## プロジェクト情報
- プロジェクトID: `classroom-checkin-279`
- リージョン: `asia-northeast1`
- サービスアカウント: `classroom-sync@classroom-checkin-279.iam.gserviceaccount.com`

## サービス一覧

| サービス名 | ソース | エンドポイント |
|-----------|--------|---------------|
| `api` | `services/api` | `/api/v1/*` |
| `notification` | `services/notification` | `/run`, `/healthz` |
| `event-collector` | `services/event-collector` | `/events/*` |
| `session` | `services/session` | `/run` |

## デプロイコマンド例

```bash
# APIサービス
gcloud run deploy api \
  --source services/api \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "AUTH_MODE=dev"

# 通知サービス
gcloud run deploy notification \
  --source services/notification \
  --region asia-northeast1 \
  --platform managed \
  --no-allow-unauthenticated \
  --set-env-vars "MAIL_PROVIDER=console"
```

---

# Cloud Scheduler設定

通知サービスを定期実行するためのCloud Scheduler設定。

## 前提条件

1. Cloud Scheduler APIが有効化されていること
2. 通知サービス（notification）がCloud Runにデプロイ済みであること
3. サービスアカウントに適切なIAMロールが付与されていること

## APIの有効化

```bash
gcloud services enable cloudscheduler.googleapis.com
```

## IAMロールの付与

Cloud SchedulerがCloud Runを呼び出すためのサービスアカウントに、`roles/run.invoker` ロールを付与:

```bash
# プロジェクト番号を取得
PROJECT_NUMBER=$(gcloud projects describe classroom-checkin-279 --format='value(projectNumber)')

# Cloud Schedulerのサービスエージェントにinvokerロールを付与
gcloud run services add-iam-policy-binding notification \
  --region asia-northeast1 \
  --member "serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-cloudscheduler.iam.gserviceaccount.com" \
  --role "roles/run.invoker"
```

または、専用のサービスアカウントを使用する場合:

```bash
# 既存のサービスアカウントを使用
gcloud run services add-iam-policy-binding notification \
  --region asia-northeast1 \
  --member "serviceAccount:classroom-sync@classroom-checkin-279.iam.gserviceaccount.com" \
  --role "roles/run.invoker"
```

## Schedulerジョブの作成

```bash
# 通知サービスのURLを取得
NOTIFICATION_URL=$(gcloud run services describe notification \
  --region asia-northeast1 \
  --format 'value(status.url)')

# Schedulerジョブを作成（毎時0分に実行）
gcloud scheduler jobs create http notification-job \
  --location asia-northeast1 \
  --schedule "0 * * * *" \
  --uri "${NOTIFICATION_URL}/run" \
  --http-method POST \
  --oidc-service-account-email classroom-sync@classroom-checkin-279.iam.gserviceaccount.com \
  --oidc-token-audience "${NOTIFICATION_URL}" \
  --time-zone "Asia/Tokyo" \
  --description "OUT忘れ通知を定期実行"
```

## スケジュールオプション

| 用途 | cron式 | 説明 |
|------|--------|------|
| 毎時実行 | `0 * * * *` | 毎時0分に実行 |
| 15分毎 | `*/15 * * * *` | 15分間隔で実行 |
| 営業時間のみ | `0 9-18 * * 1-5` | 平日9時〜18時の毎時 |
| 1日1回 | `0 9 * * *` | 毎日9時に実行 |

## 動作確認

```bash
# ジョブを手動実行
gcloud scheduler jobs run notification-job --location asia-northeast1

# ジョブの状態確認
gcloud scheduler jobs describe notification-job --location asia-northeast1

# 実行ログの確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=notification" \
  --limit 20 \
  --format "table(timestamp,textPayload)"
```

## トラブルシューティング

### 403エラーが発生する場合

サービスアカウントに`roles/run.invoker`ロールが付与されているか確認:

```bash
gcloud run services get-iam-policy notification --region asia-northeast1
```

### ジョブがタイムアウトする場合

Cloud Runのタイムアウト設定を確認（デフォルト300秒）:

```bash
gcloud run services update notification \
  --region asia-northeast1 \
  --timeout 600
```

---

# Session Processor設定

動画視聴イベントからVideoWatchSessionを生成し、動画完走時にセッションを自動クローズするジョブ。

## デプロイコマンド

```bash
gcloud run deploy session \
  --source services/session \
  --region asia-northeast1 \
  --platform managed \
  --no-allow-unauthenticated \
  --set-env-vars "FIRESTORE_PROJECT_ID=classroom-checkin-279"
```

## Schedulerジョブの作成

```bash
# セッションサービスのURLを取得
SESSION_URL=$(gcloud run services describe session \
  --region asia-northeast1 \
  --format 'value(status.url)')

# IAMロールを付与
gcloud run services add-iam-policy-binding session \
  --region asia-northeast1 \
  --member "serviceAccount:classroom-sync@classroom-checkin-279.iam.gserviceaccount.com" \
  --role "roles/run.invoker"

# Schedulerジョブを作成（毎時30分に実行）
gcloud scheduler jobs create http session-job \
  --location asia-northeast1 \
  --schedule "30 * * * *" \
  --uri "${SESSION_URL}/run" \
  --http-method POST \
  --oidc-service-account-email classroom-sync@classroom-checkin-279.iam.gserviceaccount.com \
  --oidc-token-audience "${SESSION_URL}" \
  --time-zone "Asia/Tokyo" \
  --description "動画視聴セッションを集約・更新"
```

## 処理内容

1. **VideoWatchSession生成**: 過去24時間のVideoPlaybackEventsをユーザー・講座・動画ごとに集約
2. **視聴区間計算**: PLAY/PAUSE/SEEKイベントから視聴区間（watchedRanges）を計算
3. **カバレッジ計算**: coverageRatio（視聴率）、normalSpeedRatio（1x視聴率）を算出
4. **セッション自動クローズ**: 1x速度で動画完走（ENDED）した場合、対応するopenセッションを自動クローズ
