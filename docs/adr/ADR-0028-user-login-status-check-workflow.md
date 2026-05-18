# ADR-0028: 受講者ログイン障害調査用 workflow_dispatch ツール

- **Status**: Accepted
- **Date**: 2026-05-19
- **Decision-makers**: system-279

## Context

受講者から「ログインできない」問い合わせが入った際、これまで以下の調査経路しか存在しなかった:

1. テナント管理者の管理画面で目視確認（操作教育コストあり、テナント間横断不可）
2. ローカル ADC で本番 Firestore に直接接続（個人権限依存、監査証跡なし、PII 制御なし）

ADR-0017（アクセス許可リスト）+ ADR-0027（ユーザー作成時 `allowed_emails` 自動追加）に基づき、ログイン拒否の典型原因は以下:

- メールアドレスが `allowed_emails` に未登録
- `users` には登録されているが `allowed_emails` に未登録（ADR-0027 適用前の登録ユーザー）
- メールアドレスの表記揺れ（typo / 大文字小文字 / ハイフン違い）

これらを切り分けるための定型ツールが必要だった。

## Decision

**GitHub Actions `workflow_dispatch` + 既存 CI Service Account (Workload Identity Federation) を経由した本番 Firestore 読み取りツール**を導入する。

### 実装

- `.github/workflows/check-user-status.yml`: workflow_dispatch トリガー（emails: カンマ区切り入力）
- `scripts/check-user-status.ts`: 全テナント横断で `allowed_emails` / `users` コレクションへの登録状況を確認

### CI Service Account への権限付与

`github-actions@classroom-checkin-279.iam.gserviceaccount.com` に `roles/datastore.viewer` を恒久付与。

### 出力規範（PII 最小化）

| フィールド | 出力 | 理由 |
|---|---|---|
| email | ✅ | 入力値（既知） |
| tenantId / tenantName / status | ✅ | 運用情報 |
| `inAllowedEmails` / `inUsers` / `userHasFirebaseUid` (bool) | ✅ | 判定に必要 |
| ユーザー名 / firebaseUid 文字列 | ❌ | 出力しない |

### セーフガード

- email 形式バリデーション + 重複排除 + 20 件上限
- workflow timeout-minutes: 5
- workflow_dispatch input は `env:` 経由で渡し、コマンドインジェクション回避
- tsx は root devDependency に固定（再現性確保）

## Consequences

### Positive

- 監査証跡が Actions ログに永続化される
- 個人 ADC への依存をなくし、端末切替や離任時の継続性を担保
- 再現性: 同じ手順で誰でも実行可能
- 同種の調査が必要になった際の再利用が容易

### Negative

- CI Service Account に Firestore read-only 権限が永続付与される
  - **緩和策**: 書込権限は付与しないため本番データ破壊リスクなし。不要になれば `gcloud projects remove-iam-policy-binding` で即時剥奪可能

### Alternatives considered

- **専用 SA 分離**: `audit-readonly-sa` を新規作成し別 Workload Identity Pool で運用 → 現在のプロジェクト規模ではオーバーエンジニアリングと判断。将来必要に応じて移行可能
- **workflow 内で一時付与 → revoke**: IAM 変更頻発でステップ複雑化、失敗時クリーンアップ課題 → 不採用
- **管理画面に調査機能を内蔵**: スーパー管理者画面拡張案。将来的に検討余地あり、ただし開発コストと運用頻度のバランスで今回は見送り

## References

- 運用ルール: `~/.claude/memory/feedback_firestore_prod_admin_via_workflow.md`
- 実装 PR: #41
- 関連 ADR: ADR-0017（アクセス許可リスト）, ADR-0024（スーパー管理者）, ADR-0027（ユーザー作成時 allowed_emails 自動追加）
