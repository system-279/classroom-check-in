# API仕様（v1）

## 認証
- 認証方式は後日検討（OAuth審査が必要なため）
- `AUTH_MODE=dev` の場合は `X-User-Id` / `X-User-Role` ヘッダで疑似認証
- 管理系APIは admin ロールのみ

## ベースURL
- `/api/v1`

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
  - body: `{ sessionId: string, at?: string }`
  - 退室打刻（時刻補正可）

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

### 管理: 通知ポリシー（未実装）
- `GET /admin/notification-policies`
- `POST /admin/notification-policies`
- `PATCH /admin/notification-policies/{id}`

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

## 廃止されたエンドポイント

以下のエンドポイントは、Classroom API / Forms API連携廃止に伴い削除されました：

- ~~`POST /admin/sync/classroom`~~ - Classroom同期
- ~~`GET /admin/sync/status`~~ - 同期ステータス
- ~~`GET /admin/forms`~~ - Forms一覧
- ~~`POST /admin/forms`~~ - Form登録
- ~~`PATCH /admin/forms/{id}`~~ - Form更新
- ~~`POST /admin/course-targets`~~ - CourseTargetはCourseに統合
- ~~`PATCH /admin/course-targets/{id}`~~ - CourseTargetはCourseに統合
