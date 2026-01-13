# アーキテクチャ（確定案 / GCP想定）

## 全体像
- 収集: 動画プレイヤーイベント / 手動IN/OUT入力
- 変換: IN/OUTセッションの計算・補正・集計
- 保管: セッション/イベントの永続化と分析用データ
- 可視化: 教員/管理者向けの閲覧UI

```
[Web App] -> [API Service] -> [Session Processor] -> [DB/Analytics] -> [Web UI]
   |              |                  |                    |
 Next.js       Cloud Run          Cloud Run           Firestore
   |              |               Cloud Tasks          BigQuery
   |          [Event Collector]
   |              |
   +-----> [Notification Service]
```

**注**: Classroom API / Forms API連携は廃止。講座・受講者情報は管理画面で手入力。

## コンポーネント案
- ~~Ingestion Service~~ **廃止**
  - Classroom API / Forms API連携は廃止のため不要
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
  - 講座選択UI（管理画面で手動登録した講座を表示）
  - **管理画面**: 講座・受講者の手入力管理
- Secrets / Auth
  - Secret Manager: サービスアカウント
  - Workload Identity / IAM最小権限
  - **認証方式は後日検討**（OAuth審査が必要なため）

## 同期方式
- ~~バッチ: Schedulerで日次/時間単位で取得~~ **廃止**
- 手動: 受講者/教員がIN/OUTを入力する
- 手入力: 管理者が講座・受講者を管理画面で登録
- 通知: Schedulerで未OUTセッションを検知して通知

## 決定事項
- **講座情報は管理画面で手入力**（Classroom API連携は廃止）
- 講座選択は入室前に必須で、選択した講座のClassroom URLへ遷移
- OUT忘れは通知ポリシーで初回/間隔/最大日数を設定

## 技術スタック
- 詳細は `docs/tech-stack.md` を参照

## 可観測性
- Cloud Loggingで取得・変換結果を追跡
- 失敗リトライのためのDLQ（Cloud Tasks）
