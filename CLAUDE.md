# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Google Classroomを中心に、講座単位の入退室（IN/OUT）と滞在時間を記録・可視化するシステム。Classroom APIには入退室ログがないため、自社アプリでIN/OUTボタンを提供し、動画視聴イベントやForms提出時刻を補助ソースとして活用する。

## 開発コマンド

```bash
# 依存関係のインストール（npm workspaces）
npm install

# 各サービスのビルド
npm run build -w @classroom-check-in/api
npm run build -w @classroom-check-in/ingestion
npm run build -w @classroom-check-in/event-collector
npm run build -w @classroom-check-in/session
npm run build -w @classroom-check-in/notification
npm run build -w @classroom-check-in/web

# 各サービスの起動
npm run start -w @classroom-check-in/api
npm run start -w @classroom-check-in/ingestion

# Web開発サーバー
npm run dev -w @classroom-check-in/web
```

## アーキテクチャ

```
[Google APIs] → [Ingestion Service] → [Session Processor] → [Firestore/BigQuery] → [Web UI]
                       ↓                      ↓
                 Cloud Scheduler         Cloud Tasks

[Web App] → [API Service] → [Firestore]
    ↓            ↓
    +--→ [Event Collector] → [Notification Service]
```

### サービス構成（すべてCloud Run）

| サービス | 役割 |
|---------|------|
| `services/api` | REST API（認証、入退室打刻、管理操作） |
| `services/ingestion` | Classroom/Forms同期バッチ（`/run`エンドポイント） |
| `services/event-collector` | 動画プレイヤーイベント収集 |
| `services/session` | セッション再計算ジョブ |
| `services/notification` | OUT忘れ通知送信 |
| `web` | Next.js（受講者/管理画面） |

### データフロー

1. **入室**: 講座選択 → INボタン → Session(status=open)作成 → Classroom URLへ遷移
2. **滞在**: heartbeatで継続確認、動画視聴イベントを収集
3. **退室**: OUTボタン or 動画完走 or Forms提出時刻からSession.endTimeを確定
4. **補正**: 未OUTセッションは通知ポリシーに従って通知、手動補正可能

## 技術スタック

- Node.js v24.12.0 (LTS)
- TypeScript 5.9.3, ES Modules (`type: "module"`)
- Next.js 16.1.1, React 19.2.3
- Express 5.2.1
- Firestore, BigQuery, googleapis

バージョンは`docs/tech-stack.md`と`package.json`で同期を維持すること。

## 環境変数

| 変数 | 説明 |
|------|------|
| `AUTH_MODE=dev` | ヘッダ疑似認証（`X-User-Id`, `X-User-Role`）を有効化 |
| `GOOGLE_APPLICATION_CREDENTIALS` | サービスアカウントJSONパス |
| `GOOGLE_WORKSPACE_ADMIN_SUBJECT` | ドメインワイドデリゲーション用の管理者メール |

詳細は`docs/config.md`を参照。

## 重要な設計判断

- **連続IN**: 既存openセッションがあれば新規作成せず既存を返す
- **講座同期**: ドメイン全体を取得し、CourseTargetで対象講座/表示を制御
- **1x以外の視聴**: 完走判定から除外
- **Forms**: Form IDは管理画面で手動登録、提出時刻をOUT補助に使用

全ADRは`docs/decisions.md`を参照。

## ドキュメント更新ルール

変更時は以下の順序で更新:
1. `docs/requirements.md`（仕様変更）
2. `docs/decisions.md`（判断理由をADR形式で記録）
3. `docs/open-questions.md`（未確定事項）
4. `docs/data-model.md` / `docs/architecture.md`（整合性維持）
5. `docs/tech-stack.md`（依存更新時）

## 現状と未実装

**実装済み**:
- APIの主要エンドポイント（`/courses`, `/sessions/*`, `/admin/*`）
- Classroom/Forms同期ロジック
- ヘッダ疑似認証（`AUTH_MODE=dev`）

**未実装**:
- Google OAuthログイン
- 管理画面UI
- 通知送信（SendGrid/Gmail/SMTP）
- セッション再計算ジョブ
- 動画視聴トラッキング実装
