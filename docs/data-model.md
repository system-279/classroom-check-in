# データモデル案

## 主エンティティ
注: FirestoreのドキュメントIDは、外部ID（Course ID / User ID）をそのまま使う方針。

### User
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| email | string | Googleアカウント |
| role | string | student/teacher/admin |
| externalId | string | GoogleのユーザーID |
| name | string | 表示名 |
| givenName | string | 名 |
| familyName | string | 姓 |
| photoUrl | string | アイコンURL |
| syncedAt | timestamp | 最終同期 |

### UserSettings
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| userId | string | User参照 |
| timezone | string | 表示タイムゾーン |
| notifyEmail | string | 通知先メール |
| notifyOutMissingAfterMin | int | OUT忘れ通知までの分数 |
| notifyEnabled | boolean | 通知有効化 |

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
| externalCourseId | string | Classroom Course ID |
| name | string | 講座名 |
| classroomUrl | string | ClassroomのコースURL |
| metadata | object | 任意メタ情報 |
| courseState | string | Classroomの状態 |
| creationTime | timestamp | 作成日時 |
| updateTime | timestamp | 更新日時 |
| syncedAt | timestamp | 最終同期 |

### CourseTarget
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| courseId | string | Course参照 |
| enabled | boolean | 対象講座として扱うか |
| visible | boolean | 受講者に表示するか |
| note | string | 管理用メモ |

### ClassroomSyncConfig
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| mode | string | domain_all |
| includeArchived | boolean | アーカイブを含める |
| lastSyncedAt | timestamp | 最終同期時刻 |

### Enrollment
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| courseId | string | Course参照 |
| userId | string | User参照 |
| role | string | student/teacher |
| startAt | timestamp | 参加開始 |
| endAt | timestamp | 参加終了（任意） |
| syncedAt | timestamp | 最終同期 |

### VideoAsset
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

### VideoPlaybackEvent
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

### VideoWatchSession
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

### FormMapping
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| courseId | string | Course参照 |
| formId | string | Google Forms ID |
| title | string | フォーム名 |
| active | boolean | 有効/無効 |
| lastSyncedAt | timestamp | 最終同期 |

### FormResponse
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| formId | string | Form参照 |
| responseId | string | 応答ID |
| courseId | string | Course参照（任意） |
| createTime | timestamp | 送信作成時刻 |
| lastSubmittedTime | timestamp | 最終提出時刻 |
| syncedAt | timestamp | 最終同期 |

### SyncRun
| フィールド | 型 | 説明 |
| --- | --- | --- |
| id | string | 内部ID |
| task | string | classroom-sync/forms-sync |
| stats | object | 件数集計 |
| completedAt | timestamp | 完了時刻 |

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
