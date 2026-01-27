# アーキテクチャ（確定案 / GCP想定）

## 全体像
- 収集: 手動IN/OUT入力
- 変換: IN/OUTセッションの計算・補正・集計
- 保管: セッション/イベントの永続化と分析用データ
- 可視化: 教員/管理者向けの閲覧UI

```
[Web App] -> [API Service] -> [DB/Analytics] -> [Web UI]
   |              |                |
 Next.js       Cloud Run       Firestore
   |              |             BigQuery
   +-----> [Notification Service]
```

**注**:
- **マルチテナント対応**: データレベル分離、URLパスプレフィックス（ADR-0018/0019）
- Classroom API / Forms API連携は廃止。講座・受講者情報は管理画面で手入力（ADR-0014）
- ユーザー認証はFirebase Authentication + Googleソーシャルログイン（ADR-0016）
- 動画プレイヤー連携は実装しない（ADR-0015）。IN/OUTは手動入力のみ

## マルチテナント構成（ADR-0018/0019）

```
[ユーザー] → /{tenantId}/admin/... または /{tenantId}/student/...
                    ↓
              [テナントミドルウェア]
                    ↓
              tenantId抽出 → Firestore: tenants/{tenantId}/...
```

- **データ分離**: 単一GCPプロジェクト内でテナント単位にデータ分離
- **URL構造**: `/{tenantId}/admin/...`、`/{tenantId}/student/...`
- **セルフサービス登録**: `/register` からテナント作成可能
- **セキュリティ**: Firestoreセキュリティルール + APIミドルウェアで多層防御

## コンポーネント案
- ~~Ingestion Service~~ **廃止**
  - Classroom API / Forms API連携は廃止のため不要
- API Service (Cloud Run)
  - IN/OUT打刻、講座選択、補正、管理操作のAPI
- ~~Event Collector (Cloud Run)~~ **削除済み**（ADR-0015: 動画プレイヤー連携は実装しない）
- ~~Session Processor (Cloud Run / Cloud Functions)~~ **削除済み**（ADR-0015: 動画プレイヤー連携は実装しない）
- Notification Service (Cloud Run)
  - OUT忘れなどのリマインドメール送信
  - 送信履歴の保存
- Storage
  - Firestore: セッション/イベントの即時参照
  - BigQuery: 月次/講座別分析
- Web UI
  - 教員/管理者用ダッシュボード
  - 受講者の手動IN/OUT入力
  - ~~動画視聴用プレイヤー（埋め込み/自前）~~ **スコープ外**（ADR-0015）
  - 講座選択UI（管理画面で手動登録した講座を表示）
  - **管理画面**: 講座・受講者の手入力管理
- Secrets / Auth
  - Secret Manager: サービスアカウント
  - Workload Identity / IAM最小権限
  - **認証**: Firebase Authentication + Googleソーシャルログイン（ADR-0016）
    - 開発時は`AUTH_MODE=dev`でヘッダ疑似認証（X-User-Id, X-User-Role）も使用可能

## 同期方式
- ~~バッチ: Schedulerで日次/時間単位で取得~~ **廃止**
- 手動: 受講者/教員がIN/OUTを入力する
- 手入力: 管理者が講座・受講者を管理画面で登録
- 通知: Schedulerで未OUTセッションを検知して通知

## 認証フロー（ADR-0016）

```
[ユーザー] → [Web App] → [Firebase Auth] → [Google IdP]
                ↓                              ↓
         ID Token取得 ←─────────────────────────┘
                ↓
[Web App] → Authorization: Bearer <token> → [API Service]
                                                  ↓
                                    Firebase Admin SDK でトークン検証
                                                  ↓
                                    firebaseUid → User検索 → req.user
```

1. **ログイン**: ユーザーがGoogleアカウントでFirebase Authにログイン
2. **トークン取得**: FirebaseからID Tokenを取得
3. **API呼び出し**: `Authorization: Bearer <ID Token>`ヘッダでAPIにアクセス
4. **検証**: API側でFirebase Admin SDKがトークンを検証
5. **ユーザー特定**: firebaseUidでFirestoreのUserを検索、req.userにセット
6. **初回ログイン時**: Userが存在しなければ自動作成（role=student）

## 決定事項
- **講座情報は管理画面で手入力**（Classroom API連携は廃止）
- 講座選択は入室前に必須で、選択した講座のClassroom URLへ遷移
- OUT忘れは通知ポリシーで初回/間隔/最大日数を設定
- **ユーザー認証はFirebase Authentication + Googleソーシャルログイン**（ADR-0016）

## 技術スタック
- 詳細は `docs/tech-stack.md` を参照

## 可観測性
- Cloud Loggingで取得・変換結果を追跡
- 失敗リトライのためのDLQ（Cloud Tasks）
