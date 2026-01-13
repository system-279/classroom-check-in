# API仕様（v1）

## 認証
- Google OAuthでログインし、APIはセッションCookieまたはBearerで保護
- 管理系APIは admin ロールのみ
- `AUTH_MODE=dev` の場合は `X-User-Id` / `X-User-Role` ヘッダで疑似認証

## ベースURL
- `/api/v1`

## エンドポイント

### 認証
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
  - 参加中が取得できれば参加中のみ、できなければ visible=true 全件
  - enabled=true かつ visible=true のみを返す

### 入退室
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
- `POST /api/v1/events/video`
  - body: `{ courseId, videoId, eventType, eventTime, positionSec, playbackRate, clientSessionId }`
  - 実装は Event Collector サービスで処理する

### 管理: 講座対象
- `GET /admin/courses`
  - 全講座一覧（同期済み）
- `POST /admin/course-targets`
  - body: `{ courseId, enabled, visible }`
  - `enabled=false` の場合は `visible` を自動的に false に補正
- `PATCH /admin/course-targets/{id}`
  - body: `{ enabled?, visible? }`

### 管理: 同期
- `POST /admin/sync/classroom`
  - 手動同期のトリガー
- `GET /admin/sync/status`
  - 最終同期/ステータス

### 管理: セッション補正
- `GET /admin/sessions`
  - フィルタ可能
- `POST /admin/sessions/{id}/close`
  - body: `{ closedAt: string, reason: string }`

### 管理: 通知ポリシー
- `GET /admin/notification-policies`
- `POST /admin/notification-policies`
- `PATCH /admin/notification-policies/{id}`

### 管理: Forms
- `GET /admin/forms`
- `POST /admin/forms`
  - body: `{ courseId, formId, title? }`
- `PATCH /admin/forms/{id}`

## 主要レスポンス（例）

### Course
```
{
  "id": "course_123",
  "externalCourseId": "123456",
  "name": "Math A",
  "classroomUrl": "https://classroom.google.com/...",
  "enabled": true,
  "visible": true
}
```

### Session
```
{
  "id": "sess_123",
  "courseId": "course_123",
  "userId": "user_123",
  "startTime": "2025-02-14T08:00:00Z",
  "endTime": null,
  "status": "open"
}
```
