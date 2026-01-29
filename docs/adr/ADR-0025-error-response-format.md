# ADR-0025: エラーレスポンス形式の統一

## ステータス
採用

## コンテキスト
現在のAPIエラーレスポンスには以下の問題がある：
- `message` フィールドの有無が一貫していない
- エラーコードの命名規則がバラバラ（`not_found` vs `user_not_found`）
- バリデーションエラーの詳細情報がない
- HTTPステータスコードとエラーコードの対応が暗黙的

## 決定
全APIで統一したエラーレスポンス形式を採用する。

### エラーレスポンス形式

```typescript
interface ErrorResponse {
  error: {
    code: string;        // 機械読み取り用コード (UPPER_SNAKE_CASE)
    message: string;     // 人間可読メッセージ
    details?: unknown;   // 追加情報（オプション）
  };
}
```

### HTTPステータスコードとエラーコードの対応

| HTTP | コード | 説明 |
|------|--------|------|
| 400 | `INVALID_REQUEST` | リクエスト形式不正 |
| 400 | `VALIDATION_ERROR` | バリデーション失敗 |
| 401 | `UNAUTHORIZED` | 認証が必要 |
| 401 | `TOKEN_EXPIRED` | トークン期限切れ |
| 401 | `TOKEN_INVALID` | トークン不正 |
| 403 | `FORBIDDEN` | アクセス権限なし |
| 404 | `NOT_FOUND` | リソースが存在しない |
| 409 | `CONFLICT` | リソース競合 |
| 409 | `ALREADY_EXISTS` | 既に存在する |
| 429 | `RATE_LIMIT_EXCEEDED` | レート制限超過 |
| 500 | `INTERNAL_ERROR` | サーバー内部エラー |

### 例

**バリデーションエラー**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "fields": {
        "email": "Invalid email format",
        "name": "Name is required"
      }
    }
  }
}
```

**リソース未存在**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Course not found"
  }
}
```

**認証エラー**:
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### 実装方針

1. **AppErrorクラス**: カスタムエラークラスを作成
2. **グローバルエラーハンドラー**: Express用エラーミドルウェア
3. **段階的移行**: 既存コードは徐々に移行

## 影響
- クライアント側でエラーハンドリングが統一できる
- 既存APIとの後方互換性に注意が必要
- エラーログの構造化が容易になる
