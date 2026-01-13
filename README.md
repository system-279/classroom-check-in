# Classroom Check-in

Google Classroomを中心に、講座単位の入退室（IN/OUT）と滞在時間を記録・可視化するシステム。

## 背景

Google Classroom APIには入退室ログを取得する機能がないため、自社アプリでIN/OUTボタンを提供し、動画視聴イベントやForms提出時刻を補助ソースとして活用する。

## 機能

- 講座選択とIN/OUT打刻
- 動画視聴イベントの収集・集計
- Google Forms提出時刻からのOUT推定
- OUT忘れ通知
- 管理者向けダッシュボード

## 技術スタック

- **Runtime**: Node.js v24.12.0 (LTS)
- **Frontend**: Next.js 16.1.1, React 19.2.3
- **Backend**: Express 5.2.1, TypeScript 5.9.3
- **Infrastructure**: GCP (Cloud Run, Firestore, BigQuery, Cloud Scheduler/Tasks)
- **Auth**: Google OAuth, Domain-wide Delegation

## プロジェクト構成

```
.
├── services/
│   ├── api/              # REST API (Cloud Run)
│   ├── ingestion/        # Classroom/Forms同期バッチ
│   ├── event-collector/  # 動画イベント収集
│   ├── session/          # セッション再計算ジョブ
│   └── notification/     # 通知送信ジョブ
├── web/                  # Next.js (受講者/管理画面)
└── docs/                 # 設計ドキュメント
```

## セットアップ

```bash
# 依存関係のインストール
npm install

# 各サービスのビルド
npm run build -w @classroom-check-in/api

# Web開発サーバー
npm run dev -w @classroom-check-in/web
```

## ドキュメント

詳細は [docs/README.md](docs/README.md) を参照。

- [要件](docs/requirements.md)
- [アーキテクチャ](docs/architecture.md)
- [データモデル](docs/data-model.md)
- [API仕様](docs/api.md)
- [設計判断（ADR）](docs/decisions.md)

## ライセンス

Private
