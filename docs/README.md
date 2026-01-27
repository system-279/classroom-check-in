# Classroom Check-in ドキュメント

このディレクトリは、AI駆動開発での実装・検証が進めやすいように、要件・設計・検討事項を分割して整理しています。

## 目的
- Google Classroom を中心に、講座単位の IN/OUT（入退室）と滞在時間を記録・可視化する
- AIが仕様・設計・実装を追跡しやすい構造で、意思決定と不明点を明確にする

## 重要な前提
- **マルチテナント対応**（ADR-0018/0019）: データレベル分離、セルフサービス登録
- **スーパー管理者**（ADR-0024）: 環境変数でメールアドレス指定、全テナント管理
- **OAuth認証は実装しない**（ADR-0014）
- **動画プレイヤー連携は実装しない**（ADR-0015）
- **Classroom API / Forms API連携は廃止**
- 講座・受講者情報は管理画面で手入力

## ドキュメント一覧
- `requirements.md` : 要件（機能・非機能）
- `architecture.md` : GCP前提の全体アーキテクチャ案
- `data-model.md` : データモデル案
- `flows.md` : 主要フロー（IN/OUT、通知）
- `integrations.md` : 外部連携（Gmail API等）
- `decisions.md` : 重要な設計判断（ADR形式）
- `open-questions.md` : 未確定の論点と追加調査事項
- `ai-dev-guide.md` : AIが更新する時のルールと作業ガイド
- `admin-ui.md` : 管理画面の設計方針（テナント内）
- `super-admin.md` : スーパー管理者機能（テナント横断）
- `tech-stack.md` : 技術スタックとバージョン
- `api.md` : API仕様（v1）
- `repo-structure.md` : リポジトリ構成
- `config.md` : 環境変数/設定
- `handoff.md` : 引き継ぎ要約

## 更新ルール（短縮版）
- 変更の背景・目的を必ず `decisions.md` に残す
- 未確定要素は `open-questions.md` に追加し、仮定は明示する
- 仕様変更があれば `requirements.md` を更新する
