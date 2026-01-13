# アーキテクチャ（確定案 / GCP想定）

## 全体像
- 収集: Google Classroom API / Google Forms API / 動画プレイヤーイベントからの取得
- 変換: IN/OUTセッションの計算・補正・集計
- 保管: セッション/イベントの永続化と分析用データ
- 可視化: 教員/管理者向けの閲覧UI

```
[Google APIs] -> [Ingestion Service] -> [Session Processor] -> [DB/Analytics] -> [Web UI]
       |                |                    |                 |
   Classroom         Cloud Run           Cloud Run         Firestore/SQL
   Forms API         Cloud Scheduler     Cloud Tasks       BigQuery

[Web App] -> [API Service] -> [DB/Analytics]
   |           |
   |       [Event Collector]
   |           |
   +-----> [Notification Service]
```

## コンポーネント案
- Ingestion Service (Cloud Run)
  - 各APIからの取得・正規化
  - バッチ実行は Cloud Scheduler + Cloud Tasks
  - Classroomの講座一覧/参加者情報を同期
  - ClassroomSyncConfigに基づいて同期範囲を制御
  - `/run` で classroom-sync / forms-sync を実行
- API Service (Cloud Run)
  - IN/OUT打刻、講座選択、補正、管理操作のAPI
- Event Collector (Cloud Run)
  - 動画プレイヤーのイベントをHTTPで受信
  - 高頻度イベントはバッファリング/集約
- Session Processor (Cloud Run / Cloud Functions)
  - IN/OUTイベントからセッション生成
  - 不完全なセッションの補完ロジック
- Notification Service (Cloud Run)
  - OUT忘れなどのリマインドメール送信
  - 送信履歴の保存
- Storage
  - Firestore: セッション/イベントの即時参照
  - BigQuery: 月次/講座別分析
- Web UI
  - 教員/管理者用ダッシュボード
  - 受講者の手動IN/OUT入力
  - 動画視聴用プレイヤー（埋め込み/自前）
  - 講座選択UI（Classroom連携または手動登録）
- Secrets / Auth
  - Secret Manager: OAuthクライアント/サービスアカウント
  - Workload Identity / IAM最小権限
  - Google OAuth: ログイン/認可

## 同期方式
- バッチ: Schedulerで日次/時間単位で取得
- オンデマンド: 管理画面から再同期を実行可能
- 手動: 受講者/教員がIN/OUTを入力する
- 通知: Schedulerで未OUTセッションを検知して通知

## 決定事項
- 講座同期はドメイン全体を取得し、Course IDで対象講座を指定
- 講座選択は入室前に必須で、選択した講座のClassroom URLへ遷移
- OUT忘れは通知ポリシーで初回/間隔/最大日数を設定

## 技術スタック
- 詳細は `docs/tech-stack.md` を参照

## 可観測性
- Cloud Loggingで取得・変換結果を追跡
- 失敗リトライのためのDLQ（Cloud Tasks）
