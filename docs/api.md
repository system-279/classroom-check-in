# API仕様

## 認証
- Firebase Authentication + Googleソーシャルログイン（ADR-0016）
- `AUTH_MODE=dev` の場合は `X-User-Id` / `X-User-Role` ヘッダで疑似認証
- 管理系APIは admin ロールのみ

## ベースURL
- v1: `/api/v1` （テナント非対応、後方互換用）
- v2: `/api/v2` （マルチテナント対応）

---

# v2 API（マルチテナント対応）

## テナント登録
- `POST /api/v2/tenants`
  - Firebase認証必須
  - body: `{ name: string }` （組織名）
  - レスポンス:
    ```json
    {
      "tenantId": "abc12345",
      "name": "サンプル組織",
      "adminUrl": "/abc12345/admin",
      "studentUrl": "/abc12345/student"
    }
    ```
  - セキュリティ:
    - 予約済みID検証（demo, admin, api等をブロック）
    - レート制限（5回/時/ユーザー）
  - 自動処理:
    - テナントメタデータ作成
    - オーナーをallowedEmailsに追加
    - オーナーを管理者ユーザーとして作成

## テナント内API
テナント内のリソースは以下のパスでアクセス:
- `/api/v2/{tenantId}/courses`
- `/api/v2/{tenantId}/sessions/...`
- `/api/v2/{tenantId}/admin/...`

（v1と同等のエンドポイントがテナントスコープで提供される）

---

# v1 API（後方互換）

## エンドポイント

### 認証（未実装）
- `GET /auth/google/start`
  - Google OAuth開始
- `GET /auth/google/callback`
  - OAuthコールバック
- `POST /auth/logout`
  - ログアウト
- `GET /auth/me`
  - ログインユーザー情報

### 講座
- `GET /courses`
  - 受講者向け講座一覧
  - enabled=true かつ visible=true のみを返す
  - 受講者登録がある場合は登録講座のみ、なければ全講座を返す

### 入退室
- `GET /sessions/active`
  - query: `?courseId={courseId}` (optional)
  - アクティブセッション（status=open）を取得
  - courseId指定時は該当講座のみ、省略時は全講座対象
  - セッションがない場合は `{ session: null }` を返す
- `POST /sessions/check-in`
  - body: `{ courseId: string }`
  - 入室打刻 + セッション開始（既にopenがあれば既存を返す）
- `POST /sessions/heartbeat`
  - body: `{ sessionId: string }`
  - セッション継続の心拍
- `POST /sessions/check-out`
  - body: `{ sessionId: string }`
  - 退室打刻
  - **必要視聴時間チェック**: 入室からrequiredWatchMin経過していない場合は400エラー
    - error: `not_enough_time`
    - レスポンス: `{ requiredWatchMin, elapsedSec, remainingSec }`

### 動画イベント
- `POST /events/video`
  - body: `{ courseId, videoId, eventType, eventTime, positionSec, playbackRate, clientSessionId }`
  - 実装は Event Collector サービスで処理する

### 管理: 講座（手入力）
- `GET /admin/courses`
  - 全講座一覧
- `POST /admin/courses`
  - body: `{ name, classroomUrl?, description?, enabled?, visible?, note? }`
  - 講座を新規作成
  - `enabled=false` の場合は `visible` を自動的に false に補正
- `PATCH /admin/courses/{id}`
  - body: `{ name?, classroomUrl?, description?, enabled?, visible?, note? }`
- `DELETE /admin/courses/{id}`
  - 講座を削除

### 管理: ユーザー
- `GET /admin/users`
  - 全ユーザー一覧
- `POST /admin/users`
  - body: `{ email, name?, role? }`
  - ユーザーを新規作成
  - メールアドレスの重複は409エラー
- `GET /admin/users/{id}`
  - ユーザー詳細
- `PATCH /admin/users/{id}`
  - body: `{ email?, name?, role? }`
- `DELETE /admin/users/{id}`
  - ユーザーと関連する受講登録を削除

### 管理: 受講登録
- `GET /admin/enrollments`
  - query: `?courseId={id}&userId={id}` (optional)
  - 受講登録一覧（フィルタ可能）
- `POST /admin/enrollments`
  - body: `{ courseId, userId, role?, startAt?, endAt? }`
  - 受講登録を作成
  - 重複登録は409エラー
- `PATCH /admin/enrollments/{id}`
  - body: `{ role?, startAt?, endAt? }`
  - 受講登録を更新
- `DELETE /admin/enrollments/{id}`
  - 受講登録を削除

### 管理: セッション
- `GET /admin/sessions`
  - query: `?courseId={id}&userId={id}&status={open|closed|adjusted}` (optional)
  - セッション一覧（フィルタ可能、最新100件）
- `POST /admin/sessions/{id}/close`
  - body: `{ closedAt?: string, reason?: string }`
  - セッションを強制終了（status=adjusted）
  - 補正イベント（ADJUST）を記録

### 管理: 通知ポリシー
- `GET /admin/notification-policies`
  - query: `?scope={global|course|user}&courseId={id}&userId={id}` (optional)
  - 通知ポリシー一覧（フィルタ可能）
- `POST /admin/notification-policies`
  - body: `{ scope, courseId?, userId?, firstNotifyAfterMin?, repeatIntervalHours?, maxRepeatDays?, active? }`
  - 通知ポリシーを新規作成
  - scope=course の場合は courseId 必須
  - scope=user の場合は userId 必須
  - 同じ scope/courseId/userId の組み合わせは 409 エラー
- `PATCH /admin/notification-policies/{id}`
  - body: `{ firstNotifyAfterMin?, repeatIntervalHours?, maxRepeatDays?, active? }`
  - scope/courseId/userId は変更不可
- `DELETE /admin/notification-policies/{id}`
  - 通知ポリシーを削除

### 管理: ユーザー設定
- `GET /admin/users/{id}/settings`
  - ユーザーの通知設定を取得
  - 設定がない場合はデフォルト値を返す
- `PATCH /admin/users/{id}/settings`
  - body: `{ notifyEnabled?, notifyEmail?, timezone? }`
  - ユーザーの通知設定を更新（未作成なら新規作成）

## 主要レスポンス（例）

### Course
```json
{
  "id": "abc123",
  "name": "数学A",
  "description": "数学Aの講座です",
  "classroomUrl": "https://classroom.google.com/...",
  "enabled": true,
  "visible": true,
  "note": "管理用メモ",
  "createdAt": "2025-02-14T08:00:00Z",
  "updatedAt": "2025-02-14T08:00:00Z"
}
```

### Session
```json
{
  "id": "sess_123",
  "courseId": "abc123",
  "userId": "user_123",
  "startTime": "2025-02-14T08:00:00Z",
  "endTime": null,
  "durationSec": 0,
  "source": "manual",
  "status": "open",
  "lastHeartbeatAt": "2025-02-14T08:05:00Z"
}
```

### User
```json
{
  "id": "user_123",
  "email": "student@example.com",
  "name": "山田太郎",
  "role": "student",
  "createdAt": "2025-02-14T08:00:00Z",
  "updatedAt": "2025-02-14T08:00:00Z"
}
```

### Enrollment
```json
{
  "id": "enroll_123",
  "courseId": "abc123",
  "userId": "user_123",
  "role": "student",
  "startAt": "2025-02-14T08:00:00Z",
  "endAt": null,
  "createdAt": "2025-02-14T08:00:00Z"
}
```

### NotificationPolicy
```json
{
  "id": "policy_123",
  "scope": "global",
  "courseId": null,
  "userId": null,
  "firstNotifyAfterMin": 60,
  "repeatIntervalHours": 24,
  "maxRepeatDays": 7,
  "active": true,
  "createdAt": "2025-02-14T08:00:00Z",
  "updatedAt": "2025-02-14T08:00:00Z"
}
```

### UserSettings
```json
{
  "id": "settings_123",
  "userId": "user_123",
  "notifyEnabled": true,
  "notifyEmail": "user@example.com",
  "timezone": "Asia/Tokyo",
  "updatedAt": "2025-02-14T08:00:00Z"
}
```

## 内部サービスエンドポイント

以下のエンドポイントは内部サービス間通信用です。

### Notification Service (`services/notification`)
- `POST /run`
  - OUT忘れセッションを検出してメール通知
  - Cloud Schedulerで毎時実行

## 廃止されたエンドポイント

以下のエンドポイントは、Classroom API / Forms API連携廃止に伴い削除されました：

- ~~`POST /admin/sync/classroom`~~ - Classroom同期
- ~~`GET /admin/sync/status`~~ - 同期ステータス
- ~~`GET /admin/forms`~~ - Forms一覧
- ~~`POST /admin/forms`~~ - Form登録
- ~~`PATCH /admin/forms/{id}`~~ - Form更新
- ~~`POST /admin/course-targets`~~ - CourseTargetはCourseに統合
- ~~`PATCH /admin/course-targets/{id}`~~ - CourseTargetはCourseに統合
