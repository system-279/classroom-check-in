# Classroom Check-in Handoff

最終更新: 2026-02-14

## 現在のフェーズ

**本番運用中 - 安定稼働フェーズ** - レガシーAPI/ルート削除完了

## 直近の変更履歴

| 日付 | コミット | 内容 |
|------|----------|------|
| 2026-02-14 | PR #35 | レガシールート・API削除、テナントURL未認証リダイレクト修正 |
| 2026-02-10 | 222542d | E2Eテスト修正 - useHeartbeatをテナントAPI対応に変更 |
| 2026-02-10 | b97cc14 | Firestoreエミュレータを使用するテナントE2Eテスト実装（#34） |
| 2026-02-04 | 24d540a | React Hydration Error修正（#33） |

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
| API | 305件 | ✅Pass |
| Notification | 20件 | ✅Pass |
| E2E（マルチテナント） | 5件 | ✅Pass |
| 合計 | 330件 | ✅Pass |

## 今回のセッション詳細（2026-02-14）

### 完了した作業

✅ **レガシールート・API完全削除（PR #35）**
- `services/api/src/index.ts`: 1254行→92行（legacyApiRouter約1,100行削除）
- `services/api/src/middleware/auth.ts`: 204行→39行（authMiddleware/findOrCreateUser等削除）
- `services/api/src/middleware/auth.test.ts`: 209行→90行（レガシーテスト削除）
- フロントエンド: 8ファイルをpage.tsx→page-content.tsxにリネーム、16ファイルの再エクスポート更新
- `web/app/student/page.tsx`, `web/app/admin/page.tsx` 削除

✅ **テナントURL未認証リダイレクト修正**
- `web/app/[tenant]/page.tsx`: Firebase認証モードで未ログイン時にGoogleログインボタン表示
- 全page-contentファイルの`router.push("/")`をテナント対応化
- `use-authenticated-fetch.ts`のリダイレクトもテナント対応化

✅ **ルートページ改善**
- `web/app/page.tsx`: ログイン後テナント一覧表示（1件→自動リダイレクト、複数→選択、0件→登録案内）

✅ **ドキュメント更新**
- `docs/handoff.md`: APIエンドポイントをv2パスに更新
- `docs/config.md`: サービスエンドポイントをv2に更新

### 変更規模
- 32ファイル変更、259行追加、1,602行削除
- APIテスト305件全Pass、ビルド成功、型チェック通過

### システム状態
✅ `/api/v1/*`完全削除 → `/api/v2/:tenant/*`に一本化
✅ レガシーフロントエンドルート（`/student/*`, `/admin/*`）削除
✅ テナントURL未認証時の正しいログインフロー実装
✅ 再開可能（ドキュメント整合性・コード品質確認済み）
