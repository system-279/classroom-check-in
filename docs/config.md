# 環境変数・設定

## 共通
- `FIRESTORE_PROJECT_ID`:
  - FirestoreのプロジェクトID（未設定なら `GCLOUD_PROJECT` / `GOOGLE_CLOUD_PROJECT` を参照）
- `GOOGLE_APPLICATION_CREDENTIALS`:
  - サービスアカウントJSONのパス
- `GOOGLE_WORKSPACE_ADMIN_SUBJECT`:
  - ドメイン全体を同期する場合の委任先（管理者メール）
  - ドメイン全体同期には通常、ドメインワイドデリゲーションが必要
  - 併せて `GOOGLE_APPLICATION_CREDENTIALS` が必須

## API Service (`services/api`)
- `AUTH_MODE`:
  - `dev` ならヘッダ疑似認証が有効
  - `dev` 以外はOAuth実装が必要

## Ingestion Service (`services/ingestion`)
- `CLASSROOM_PAGE_SIZE` (default: 100)
- `CLASSROOM_INCLUDE_ARCHIVED` (default: false)
- `CLASSROOM_SYNC_STUDENTS` (default: true)
- `CLASSROOM_SYNC_TEACHERS` (default: true)
- `FORMS_PAGE_SIZE` (default: 200)
- `/run` 実行時、認証情報が無い場合は `428 gcp_credentials_required` を返す

## Notification Service (`services/notification`)
- 通知チャネルに応じたAPIキー/SMTP設定（後続で確定）
