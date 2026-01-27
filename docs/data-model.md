# データモデル案

## マルチテナント構造（ADR-0018）

すべてのデータはテナント単位で分離されます。Firestoreのパス構造:

```
tenants/{tenantId}/
  ├── allowed_emails/{id}
  ├── courses/{id}
  ├── users/{id}
  ├── user_settings/{id}
  ├── sessions/{id}
  ├── enrollments/{id}
  ├── notification_policies/{id}
  └── notification_logs/{id}
```

## 主エンティティ

注: Classroom API / Forms API連携は廃止。講座・受講者情報は管理画面で手入力。

### Tenant
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | テナントID（8文字英数字、自動生成） |
| name | string | 組織名 |
| ownerEmail | string | オーナーのメールアドレス |
| ownerFirebaseUid | string | オーナーのFirebase UID |
| status | string | active/suspended |
| createdAt | timestamp | 作成日時 |
| updatedAt | timestamp | 更新日時 |

注: セルフサービス登録で作成（ADR-0019）。オーナーは自動的に管理者として登録される。

### AllowedEmail
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| email | string | 許可するメールアドレス |
| note | string | 管理用メモ（任意） |
| createdAt | timestamp | 作成日時 |

注: 新規ユーザーのログインを制限するための許可リスト。このリストに含まれるメールアドレスのみ新規登録が可能。既存ユーザーは許可リストに関係なくアクセス可能。

### User
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| firebaseUid | string | Firebase AuthenticationのUID |
| email | string | メールアドレス（Firebaseから取得） |
| name | string | 表示名（Firebaseから取得） |
| role | string | student/teacher/admin |
| createdAt | timestamp | 作成日時 |
| updatedAt | timestamp | 更新日時 |

注: Firebase Authentication導入に伴い`firebaseUid`を追加（ADR-0016）。初回ログイン時にUser自動作成（role=student）。新規ユーザーはAllowedEmailに登録されている場合のみ作成可能。
注: Classroom API連携廃止に伴い、externalId/givenName/familyName/photoUrl/syncedAtは廃止（ADR-0014）。

### UserSettings
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| userId | string | User参照 |
| notifyEnabled | boolean | 通知有効化 |
| notifyEmail | string | 通知先メール |
| timezone | string | 表示タイムゾーン |
| createdAt | timestamp | 作成日時 |
| updatedAt | timestamp | 更新日時 |

注: notifyOutMissingAfterMinはNotificationPolicy.firstNotifyAfterMinに統合。

### NotificationPolicy
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| scope | string | global/course/user |
| courseId | string | Course参照（任意） |
| userId | string | User参照（任意） |
| firstNotifyAfterMin | int | 初回通知までの分数 |
| repeatIntervalHours | int | 再通知間隔 |
| maxRepeatDays | int | 何日間繰り返すか |
| active | boolean | 有効/無効 |

### Course
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| name | string | 講座名（手入力） |
| description | string | 講座説明（任意） |
| classroomUrl | string | ClassroomのコースURL（手入力） |
| requiredWatchMin | int | 必要視聴時間（分）。デフォルト63分 |
| enabled | boolean | 対象講座として扱うか |
| visible | boolean | 受講者に表示するか |
| note | string | 管理用メモ |
| createdAt | timestamp | 作成日時 |
| updatedAt | timestamp | 更新日時 |

~~### CourseTarget~~ **Courseに統合**

~~### ClassroomSyncConfig~~ **廃止**（Classroom API連携廃止のため）

### Enrollment
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| courseId | string | Course参照 |
| userId | string | User参照 |
| role | string | student/teacher |
| startAt | timestamp | 参加開始（手入力） |
| endAt | timestamp | 参加終了（任意） |
| createdAt | timestamp | 登録日時 |

注: Enrollment（受講者リスト）は管理画面で手入力。

### ~~VideoAsset~~ **スコープ外**（ADR-0015: 動画プレイヤー連携は実装しない）
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| courseId | string | Course参照 |
| title | string | 動画タイトル |
| provider | string | youtube/custom/other |
| externalVideoId | string | 外部動画ID |
| durationSec | int | 動画の長さ |
| policy | object | 必須視聴割合/速度ルール |
| embedUrl | string | 埋め込みURL |

### ~~VideoPlaybackEvent~~ **スコープ外**（ADR-0015）
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| courseId | string | Course参照 |
| userId | string | User参照 |
| videoId | string | VideoAsset参照 |
| eventType | string | PLAY/PAUSE/HEARTBEAT/SEEK/RATE_CHANGE/ENDED |
| eventTime | timestamp | 発生時刻 |
| positionSec | number | 再生位置 |
| playbackRate | number | 再生速度 |
| sourceRef | string | クライアントセッションID |
| payload | object | 生データ（監査用） |

### ~~VideoWatchSession~~ **スコープ外**（ADR-0015）
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| courseId | string | Course参照 |
| userId | string | User参照 |
| videoId | string | VideoAsset参照 |
| startTime | timestamp | 視聴開始 |
| endTime | timestamp | 視聴終了 |
| watchedRanges | array | 視聴区間の配列 |
| coverageRatio | number | 視聴率（0-1） |
| normalSpeedRatio | number | 1x視聴率（0-1） |
| status | string | in_progress/completed/invalid |

### NotificationLog
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| userId | string | User参照 |
| courseId | string | Course参照 |
| sessionId | string | Session参照 |
| type | string | out_missing/reminder |
| channel | string | email |
| sentAt | timestamp | 送信時刻 |
| status | string | sent/failed |

~~### FormMapping~~ **廃止**（Forms API連携廃止のため）

~~### FormResponse~~ **廃止**（Forms API連携廃止のため）

~~### SyncRun~~ **廃止**（API同期廃止のため）

### AttendanceEvent
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| courseId | string | Course参照 |
| userId | string | User参照 |
| eventType | string | IN/OUT/ADJUST |
| eventTime | timestamp | 発生時刻 |
| source | string | video/manual/test/reports |
| sourceRef | string | 外部ID（任意） |
| payload | object | 生データ（監査用） |

### Session
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| courseId | string | Course参照 |
| userId | string | User参照 |
| startTime | timestamp | IN時刻 |
| endTime | timestamp | OUT時刻（未確定可） |
| durationSec | int | 滞在時間（計算値） |
| source | string | video/manual/test/reports |
| confidence | number | 推定信頼度（任意） |
| status | string | open/closed/adjusted |
| lastHeartbeatAt | timestamp | 最終heartbeat時刻 |

### SourceMapping
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| courseId | string | Course参照 |
| mappingType | string | video_asset/calendar/manual |
| mappingValue | string | 外部IDやURL |
| validFrom | timestamp | 有効開始 |
| validTo | timestamp | 有効終了 |

## 補助テーブル
- CorrectionLog: 手動補正の履歴
