# 重要な設計判断（ADR）

## ADR-0001: IN/OUT取得の一次ソース
- 状態: 採用
- 背景: Classroom API単体では入退室情報が取れない
- 判断: 動画プレイヤーの視聴イベントを一次ソースとして扱う
- 影響: 埋め込みプレイヤー前提となり、外部視聴は計測不可

## ADR-0002: OUT未確定セッションの扱い
- 状態: 採用
- 背景: 動画視聴/手動入力ではOUTが遅延する
- 判断: end_time=null の open セッションを許容し、後で補完
- 影響: 集計時にopenセッションの扱いを決める必要

## ADR-0003: 再生速度の扱い
- 状態: 採用
- 背景: 速度変更やシークによる実質視聴の担保が必要
- 判断: 1x以外の視聴区間は無効または別扱いにし、完走判定に含めない
- 影響: プレイヤー側での速度監視と、判定ロジックの整備が必要

## ADR-0004: 入退室のUI提供
- 状態: 採用
- 背景: Classroom自体に入退室ログ取得APIがないため代替が必要
- 判断: 自社WebアプリでIN/OUTボタンを提供し、手動入力を一次ソースとする
- 影響: ユーザー体験と通知/補正フローの設計が重要

## ADR-0005: テスト（Forms）連携の方針
- 状態: **廃止**
- 背景: Forms APIもOAuth認証が必要で、外部ユーザー対応のための審査コストが高い
- 判断: Forms連携は廃止し、OUT時刻は手動入力または動画視聴完了で確定する
- 影響: Forms提出時刻によるOUT補助は使用不可

## ADR-0006: 講座一覧の取得と選択
- 状態: **改訂**（旧: Classroom API同期）
- 背景: 入室前に講座選択を必須にしたい。ただしClassroom APIはOAuth審査が必要
- 判断: 講座情報は管理画面で手入力する。Classroom URLも手入力で登録
- 影響: 管理者が講座名・URL・受講者を手動で管理する必要がある

## ADR-0007: 対象講座の表示制御
- 状態: 採用
- 背景: 対象講座の中でも表示/非表示を制御したい
- 判断: CourseTargetにvisibleフラグを追加し、UI表示を管理者が制御する
- 影響: 管理画面と同期の整合性が必要

## ADR-0008: 講座同期の範囲
- 状態: **改訂**（旧: ドメイン全体同期）
- 背景: 無料アカウントや外部ドメインのユーザーも対象となるため、ドメインワイドデリゲーションは使用不可
- 判断: 管理者がCourse IDを手動登録し、受講者は自身のOAuthで取得した講座と照合する
- 影響: 管理者はCourse IDを事前に把握する必要がある。受講者は登録済み講座のみ表示される

## ADR-0009: 基本アーキテクチャ
- 状態: 採用
- 背景: 入退室/講座同期/通知/動画計測をGCPで安定運用したい
- 判断: Cloud Run中心（Ingestion/API/Event/Notification/Session）+ Firestore/BigQuery + Scheduler/Tasksを採用
- 影響: バッチとリアルタイムの二系統運用、IAM設計が重要

## ADR-0010: 技術スタックとバージョン
- 状態: 採用
- 背景: 実装とドキュメントの一致を保証する必要がある
- 判断: `docs/tech-stack.md` に記載の安定版を採用し、実装依存と一致させる
- 影響: 依存更新時はドキュメントの更新が必須

## ADR-0011: モノレポ構成
- 状態: 採用
- 背景: API/バッチ/通知/フロントを一括で管理したい
- 判断: npm workspaces で `services/*` と `web/` を管理する
- 影響: ルートの依存管理とCI設計が必要

## ADR-0012: 連続INの扱い
- 状態: 採用
- 背景: 連続してINが押される可能性がある
- 判断: 既存openセッションがあればそれを返し、新規作成しない
- 影響: クライアントは同一セッションを再利用する必要がある

## ADR-0013: Classroom同期の認証方式
- 状態: **廃止**（旧: サービスアカウント + DWD → ユーザーOAuth）
- 背景: 無料アカウントや外部ドメインのユーザーも対象。DWDは自ドメインWorkspace内のみ有効
- 判断: Classroom API連携自体を廃止。講座・受講者情報は管理画面で手入力する
- 影響: OAuth認証は不要。講座管理は完全手動

## ADR-0014: Google OAuth（API連携用）の見送り
- 状態: 採用
- 背景:
  - Google OAuth（Classroom API / Forms API等のGoogle APIアクセス用）はGoogle審査が必要
  - 外部ユーザー対応のための審査コストが高い
- 判断: Google OAuthによるAPI連携は実装しない。講座・受講者情報は管理画面で手入力する
- 注記: **ユーザーログインにはFirebase Authenticationを採用**（ADR-0016参照）。Firebase AuthはGoogle審査不要
- 影響: Classroom API / Forms APIとの自動同期は使用不可

## ADR-0015: 動画プレイヤー連携の廃止
- 状態: 採用
- 背景: 埋め込みプレイヤーの実装・運用コストが高く、外部動画（YouTube等）の計測にも制約がある
- 判断: 動画視聴イベントの収集・完走判定機能は実装しない。IN/OUTは手動入力のみとする
- 影響: Event Collector / Session Processorの動画関連機能は使用しない。OUT忘れ対策は通知に依存

## ADR-0016: Firebase Authenticationの採用
- 状態: 採用
- 背景:
  - ADR-0014で断念した「Google OAuth」はClassroom API等のGoogle APIアクセス用であり、Google審査が必要
  - 一方、Firebase AuthenticationはGoogleの審査不要でユーザーログイン機能を提供できる
  - 本番運用にはユーザー認証が必須であり、ヘッダ疑似認証では運用できない
- 判断:
  - Firebase Authentication + Googleソーシャルログインを採用する
  - Google OAuthによるAPI連携（Classroom API等）は引き続き実装しない（ADR-0014）
- 認証フロー:
  1. Web: Firebase SDKでGoogleソーシャルログイン
  2. Web: FirebaseからID Tokenを取得
  3. Web: API呼び出し時に`Authorization: Bearer <ID Token>`ヘッダで送信
  4. API: Firebase Admin SDKでID Tokenを検証
  5. API: 検証成功→firebaseUidでUserを特定し、req.userにセット
- 影響:
  - Userエンティティに`firebaseUid`フィールドを追加
  - 初回ログイン時にUser自動作成（role=student）、管理者が後からroleを変更
  - 開発時は`AUTH_MODE=dev`でヘッダ疑似認証を継続利用可能
  - Firebaseプロジェクトの設定が必要（GCPプロジェクトと同一で可）
