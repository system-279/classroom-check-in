# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Google Classroomを中心に、講座単位の入退室（IN/OUT）と滞在時間を記録・可視化するシステム。Classroom APIには入退室ログがないため、自社アプリでIN/OUTボタンを提供する。

**注**:
- Classroom API / Forms API連携は廃止（OAuth審査コストが高いため）。講座・受講者情報は管理画面で手入力（ADR-0014）
- ユーザー認証はFirebase Authentication + Googleソーシャルログイン（ADR-0016）
- 動画プレイヤー連携は実装しない（ADR-0015）。IN/OUTは手動入力のみ

## 開発コマンド

```bash
# 依存関係のインストール（npm workspaces）
npm install

# 各サービスのビルド
npm run build -w @classroom-check-in/api
npm run build -w @classroom-check-in/notification
npm run build -w @classroom-check-in/web

# 各サービスの起動
npm run start -w @classroom-check-in/api

# Web開発サーバー
npm run dev -w @classroom-check-in/web
```

## アーキテクチャ

```
[Web App] → [API Service] → [Firestore/BigQuery] → [Web UI]
    |
    +--→ [Notification Service]
```

### サービス構成（すべてCloud Run）

| サービス | 役割 |
|---------|------|
| `services/api` | REST API（認証、入退室打刻、管理操作） |
| `services/notification` | OUT忘れ通知送信 |
| `web` | Next.js（受講者/管理画面） |

### データフロー

1. **入室**: 講座選択 → INボタン → Session(status=open)作成 → Classroom URLへ遷移
2. **滞在**: heartbeatで継続確認
3. **退室**: OUTボタンでSession.endTimeを確定
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
| `AUTH_MODE` | `dev`=ヘッダ疑似認証、`firebase`=Firebase認証（本番用） |
| `GOOGLE_APPLICATION_CREDENTIALS` | サービスアカウントJSONパス |
| `FIREBASE_PROJECT_ID` | Firebase プロジェクトID |
| `DEMO_ENABLED` | `true`=デモモード有効（読み取り専用） |

詳細は`docs/config.md`を参照。

## 重要な設計判断

- **連続IN**: 既存openセッションがあれば新規作成せず既存を返す（ADR-0012）
- **講座管理**: 管理画面で手入力（Classroom API連携は廃止）（ADR-0014）
- **認証方式**: Firebase Authentication + Googleソーシャルログイン（ADR-0016）
- **アクセス許可リスト**: 新規ユーザーは事前登録されたメールのみログイン可能（ADR-0017）
- **動画プレイヤー**: 連携は実装しない（ADR-0015）

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
- ヘッダ疑似認証（`AUTH_MODE=dev`）
- GCPプロジェクト設定（`classroom-checkin-279`）
- 管理画面UI（講座管理・受講者管理・セッション管理・通知ポリシー管理）
- 受講者向けUI（講座選択・IN/OUT・heartbeat）
- Tailwind CSS v4 + shadcn/ui セットアップ
- 通知サービス（OUT忘れ検出・Gmail API送信・ログ記録）
- 通知ポリシー管理API・UI（スコープ別設定）
- Cloud Scheduler設定（通知サービス毎時実行）
- ユーザー設定管理API（通知設定）
- **Cloud Runデプロイ**:
  - API: https://api-102013220292.asia-northeast1.run.app
  - Web UI: https://web-102013220292.asia-northeast1.run.app
- Artifact Registry クリーンアップポリシー（最新2イメージ保持）
- Firebase Authentication（ADR-0016）
  - Googleソーシャルログイン有効
  - API: Firebase Admin SDK、トークン検証
  - Web: Firebase SDK、AuthContext、ログインUI

- GitHub Pagesドキュメントサイト: https://system-279.github.io/classroom-check-in/
- **GitHub Actions CI/CD**:
  - CI: lint, type-check, build（PRとmain push時）
  - CD: Cloud Run自動デプロイ（main push時）
  - Workload Identity Federation認証
- **ESLint設定**: TypeScript + React + Next.js対応
- **デモモード**: 認証不要の読み取り専用モード
  - `/demo/*` パスで管理画面・受講者画面を閲覧可能
  - `DEMO_ENABLED=true` で有効化
  - POST/PATCH/DELETE/PUT はブロック（403）
  - シードデータ: `scripts/seed-demo.ts`

**スコープ外**（実装予定なし）:
- Google OAuth（Classroom API連携用）（ADR-0014: 審査コストが高いため実装しない）
- 動画プレイヤー連携（ADR-0015: 埋め込みプレイヤー実装・運用コストが高いため実装しない。IN/OUTは手動入力のみ）
