# リポジトリ構成

```
.
├── docs/
├── services/
│   ├── api/              # REST API (Cloud Run)
│   └── notification/     # 通知送信ジョブ (Cloud Run)
├── web/                  # Next.js (受講者/管理画面)
└── package.json          # npm workspaces
```

## 削除済みサービス
- ~~`services/ingestion`~~: Classroom/Forms API連携廃止のため削除
- ~~`services/event-collector`~~: 動画プレイヤー連携廃止のため削除（ADR-0015）
- ~~`services/session`~~: 動画プレイヤー連携廃止のため削除（ADR-0015）

## 命名規則
- サービス名は役割を表す単語で固定
- 共通設定はルートに配置（tsconfig, lint）
- 環境変数は各サービスに分離
