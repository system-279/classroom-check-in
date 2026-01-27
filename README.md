# Classroom Check-in

Google Classroomを中心に、講座単位の入退室（IN/OUT）と滞在時間を記録・可視化するシステム。

## 背景

Google Classroom APIには入退室ログを取得する機能がないため、自社アプリでIN/OUTボタンを提供する。

**注**:
- Classroom API / Forms API連携は廃止（OAuth審査コストが高いため）
- 講座・受講者情報は管理画面で手入力
- OAuth認証は実装しない（ADR-0014）
- 動画プレイヤー連携は実装しない（ADR-0015）

## 機能

- **マルチテナント対応**: 複数組織で独立した入退室管理（ADR-0018/0019）
- **セルフサービス登録**: `/register` からテナント作成可能
- 講座選択とIN/OUT打刻
- Heartbeatによる滞在確認
- OUT忘れ通知
- 管理者向け管理画面（講座・受講者・セッション・通知ポリシー）

## 技術スタック

- **Runtime**: Node.js v24.12.0 (LTS)
- **Frontend**: Next.js 16.1.1, React 19.2.3
- **Backend**: Express 5.2.1, TypeScript 5.9.3
- **Infrastructure**: GCP (Cloud Run, Firestore, BigQuery, Cloud Scheduler)
- **Auth**: ヘッダ疑似認証（開発用）

## プロジェクト構成

```
.
├── services/
│   ├── api/              # REST API (Cloud Run)
│   └── notification/     # 通知送信ジョブ (Cloud Run)
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

## デプロイ済み環境

- **API**: https://api-102013220292.asia-northeast1.run.app
- **Web UI**: https://web-102013220292.asia-northeast1.run.app
- **ドキュメント**: https://system-279.github.io/classroom-check-in/

## ライセンス

Private
