# Classroom Check-in Handoff

最終更新: 2026-03-08 00:35 JST

## 現在のフェーズ

**本番運用中 - 機能完成・安定稼働フェーズ**

## 直近の変更履歴

| 日付 | コミット | 内容 |
|------|----------|------|
| 2026-03-08 | PR #39 | Smoke Testコールドスタート対策（タイムアウト延長+ウォームアップ）+lint設定修正 |
| 2026-03-08 | PR #37 | 未ログイン画面にデモリンクを追加（Nightly Smoke Test修正） |
| 2026-02-14 | PR #36 | スーパー管理者テナント削除機能追加、ログイン画面リンク整理 |
| 2026-02-14 | PR #35 | レガシールート・API削除、テナントURL未認証リダイレクト修正 |
| 2026-02-10 | 222542d | E2Eテスト修正 - useHeartbeatをテナントAPI対応に変更 |
| 2026-02-10 | b97cc14 | Firestoreエミュレータを使用するテナントE2Eテスト実装（#34） |

## MVP実装状況

| 機能 | 状態 | 備考 |
|------|------|------|
| 入退室打刻 | ✅完了 | IN/OUT、heartbeat |
| 管理画面 | ✅完了 | 講座・受講者・セッション・通知ポリシー管理 |
| 受講者画面 | ✅完了 | 講座一覧、セッションタイマー |
| Firebase認証 | ✅完了 | Googleソーシャルログイン |
| マルチテナント | ✅完了 | URLパスプレフィックス分離 |
| テナント登録 | ✅完了 | セルフサービス |
| スーパー管理者 | ✅完了 | 全テナント管理 |
| OUT忘れ通知 | ✅完了 | 通知サービス、Cloud Scheduler |
| セルフチェックアウト | ✅完了 | 受講者が退室時刻を指定 |
| 再入室禁止 | ✅完了 | 同一講座への再入室ブロック |
| デモモード | ✅完了 | 読み取り専用 |

## 次のアクション候補

1. **パス変換ロジック統一** - `use-authenticated-fetch.ts`と`auth-fetch-context.tsx`のv1→v2変換ロジック重複を解消
2. **ページコンポーネントのAPIパス直接v2化** - `authFetch("/api/v1/...")`をv2パスに書き換え、変換レイヤー削除
3. **新機能検討** - 運用フィードバックに基づく改善

## デプロイ済みインフラ

| サービス | URL |
|----------|-----|
| API | https://api-102013220292.asia-northeast1.run.app |
| Web | https://web-102013220292.asia-northeast1.run.app |
| Notification | https://notification-102013220292.asia-northeast1.run.app |
| Docs | https://system-279.github.io/classroom-check-in/ |

## テスト状況

| サービス | テスト数 | 状態 |
|----------|----------|------|
| API | 314件 | ✅Pass |
| Notification | 20件 | ✅Pass |
| E2E（マルチテナント） | 5件 | ✅Pass |
| Nightly Smoke Test | 9件 | ✅Pass |
| 合計 | 348件 | ✅Pass |

## 今回のセッション詳細（2026-03-08）

### 完了した作業

✅ **未ログイン画面にデモリンク追加（PR #37）**
- Firebase認証モードの未ログイン画面（早期return）にデモリンクがなく、Nightly Smoke Testが失敗していた
- `web/app/page.tsx` の未ログイン画面に「デモを見る →」リンクを追加
- ブラウザ目視確認（スクリーンショット）+E2Eテストpass確認済み

✅ **Smoke Testコールドスタート対策（PR #39）**
- 原因: Cloud Run APIコンテナが深夜スケールダウン → コールドスタートで5秒タイムアウト超過
- E2Eテスト: `test.setTimeout(30s)`、API依存assertに`timeout: 15_000`追加
- Smoke Test: health checkステップでデモAPI（`/api/v2/demo/courses`）も叩いてウォームアップ
- `.playwright-mcp/` をgitignore・eslint ignoreに追加（トレースファイルがlint対象に含まれ3500+エラーになっていた）
- 手動Smoke Test実行で全9件pass確認済み

### システム状態
✅ Nightly Smoke Test: 連日失敗 → 全件pass復旧
✅ CI: Lint/TypeCheck/Build 全pass
✅ 再開可能（コード品質・テスト・ドキュメント整合性確認済み）
