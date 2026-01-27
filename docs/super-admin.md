# スーパー管理者機能

## 概要

全テナントを一覧・管理できるシステム管理者向けの機能です。
テナント横断的な操作（停止/再開、全体監視）を行う権限を持ちます。

> ADR-0024: スーパー管理者機能

## アクセス方法

### 1. 環境変数の設定

API サーバーに `SUPER_ADMIN_EMAILS` 環境変数を設定します。

```bash
# カンマ区切りで複数指定可能
SUPER_ADMIN_EMAILS=admin@example.com,ops@example.com
```

**本番環境**: Cloud Secret Manager での管理を推奨

```bash
# Cloud Run への設定例
gcloud run services update api \
  --region asia-northeast1 \
  --set-env-vars "SUPER_ADMIN_EMAILS=admin@example.com"
```

### 2. ログイン

1. 通常通り Google アカウントでログイン
2. ログインに使用するメールアドレスが `SUPER_ADMIN_EMAILS` に含まれている必要があります

### 3. 管理画面へアクセス

```
https://{your-domain}/super-admin
```

ローカル開発時:
```
http://localhost:3000/super-admin
```

## 機能一覧

### テナント管理 (`/super-admin/tenants`)

| 機能 | 説明 |
|------|------|
| テナント一覧 | 全テナントをページング表示 |
| ステータスフィルター | 有効/停止中でフィルタリング |
| テナント停止 | テナントを停止状態に変更 |
| テナント再開 | 停止中のテナントを再開 |

## API エンドポイント

| メソッド | パス | 機能 |
|---------|------|------|
| GET | `/api/v2/super/tenants` | 全テナント一覧（ページング対応） |
| GET | `/api/v2/super/tenants/:id` | テナント詳細（統計情報含む） |
| PATCH | `/api/v2/super/tenants/:id` | テナントステータス変更 |

### GET /api/v2/super/tenants

**クエリパラメータ:**

| パラメータ | 型 | デフォルト | 説明 |
|-----------|------|----------|------|
| status | string | - | `active` または `suspended` |
| limit | number | 50 | 取得件数（最大100） |
| offset | number | 0 | オフセット |
| sort | string | createdAt | `createdAt`, `name`, `updatedAt` |
| order | string | desc | `asc` または `desc` |

**レスポンス例:**

```json
{
  "tenants": [
    {
      "id": "abc12345",
      "name": "テスト組織",
      "ownerEmail": "owner@example.com",
      "status": "active",
      "createdAt": "2026-01-27T10:00:00.000Z",
      "updatedAt": "2026-01-27T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### GET /api/v2/super/tenants/:id

**レスポンス例:**

```json
{
  "tenant": {
    "id": "abc12345",
    "name": "テスト組織",
    "ownerId": "firebase-uid-xxx",
    "ownerEmail": "owner@example.com",
    "status": "active",
    "createdAt": "2026-01-27T10:00:00.000Z",
    "updatedAt": "2026-01-27T10:00:00.000Z"
  },
  "stats": {
    "userCount": 10,
    "courseCount": 5,
    "sessionCount": 100
  }
}
```

### PATCH /api/v2/super/tenants/:id

**リクエストボディ:**

```json
{
  "status": "suspended"
}
```

## 認可の仕組み

1. Firebase 認証でログイン（ID トークン取得）
2. API リクエスト時に `Authorization: Bearer <ID Token>` ヘッダを付与
3. サーバー側でトークンを検証し、メールアドレスを取得
4. `SUPER_ADMIN_EMAILS` に含まれるか判定
5. 含まれない場合は 403 Forbidden

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Web UI    │────▶│  API Server │────▶│  Firestore  │
│             │     │             │     │             │
│ ID Token    │     │ Email Check │     │  tenants/*  │
└─────────────┘     └─────────────┘     └─────────────┘
```

## セキュリティ考慮事項

| 項目 | 対応 |
|------|------|
| 管理者リストの保護 | サーバーサイドのみで保持（クライアントに公開しない） |
| 操作ログ | 全操作をコンソールログに記録 |
| Firestore ルール | 変更不要（API 経由のみアクセス） |
| 本番環境 | Cloud Secret Manager での管理を推奨 |

## テナント停止時の影響

テナントを停止すると:

- 該当テナントの全ユーザーがアクセス不可になります
- 既存のセッションデータは保持されます（削除されません）
- テナントオーナーも含め、誰もログインできなくなります
- 再開すれば元通りアクセス可能になります

## 開発モードでのテスト

`AUTH_MODE=dev` の場合、`X-User-Email` ヘッダでスーパー管理者をシミュレートできます。

```bash
# スーパー管理者としてテナント一覧を取得
curl -H "X-User-Email: admin@example.com" \
  http://localhost:8080/api/v2/super/tenants
```

※ `SUPER_ADMIN_EMAILS` に `admin@example.com` が含まれている必要があります。

## トラブルシューティング

### 403 Forbidden が返る

1. `SUPER_ADMIN_EMAILS` が設定されているか確認
2. ログインに使用したメールアドレスが含まれているか確認
3. メールアドレスの大文字/小文字は区別されません（自動で小文字に正規化）

### 「スーパー管理者機能は無効です」と表示される

`SUPER_ADMIN_EMAILS` 環境変数が設定されていません。API サーバーの環境変数を確認してください。

### 認証エラー

1. Firebase 認証が正しく設定されているか確認
2. `AUTH_MODE=firebase` が設定されているか確認
3. ID トークンの有効期限が切れていないか確認（再ログインを試す）
