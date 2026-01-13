# リポジトリ構成

```
.
├── docs/
├── services/
│   ├── api/              # REST API (Cloud Run)
│   ├── event-collector/  # 動画イベント収集 (Cloud Run)
│   ├── ingestion/        # Classroom/Forms同期バッチ (Cloud Run)
│   ├── session/          # セッション再計算ジョブ (Cloud Run)
│   └── notification/     # 通知送信ジョブ (Cloud Run)
├── web/                  # Next.js (受講者/管理画面)
└── package.json          # npm workspaces
```

## 命名規則
- サービス名は役割を表す単語で固定
- 共通設定はルートに配置（tsconfig, lint）
- 環境変数は各サービスに分離
