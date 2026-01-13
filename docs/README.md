# Classroom Check-in ドキュメント

このディレクトリは、AI駆動開発での実装・検証が進めやすいように、要件・設計・検討事項を分割して整理しています。

## 目的
- Google Classroom を中心に、講座単位の IN/OUT（入退室）と滞在時間を記録・可視化する
- AIが仕様・設計・実装を追跡しやすい構造で、意思決定と不明点を明確にする

## ドキュメント一覧
- `docs/requirements.md` : 要件（機能・非機能）
- `docs/architecture.md` : GCP前提の全体アーキテクチャ案
- `docs/data-model.md` : データモデル案
- `docs/flows.md` : 主要フロー（IN/OUT計算、同期/非同期）
- `docs/integrations.md` : Google Classroom/Meet/Reports APIの連携方針
- `docs/research.md` : 2026/01/13時点を想定したWeb情報の調査メモ
- `docs/decisions.md` : 重要な設計判断（ADR形式）
- `docs/open-questions.md` : 未確定の論点と追加調査事項
- `docs/ai-dev-guide.md` : AIが更新する時のルールと作業ガイド
- `docs/video-tracking.md` : 動画視聴トラッキングの設計指針
- `docs/admin-ui.md` : 管理画面の設計方針
- `docs/tech-stack.md` : 技術スタックとバージョン
- `docs/api.md` : API仕様（v1）
- `docs/repo-structure.md` : リポジトリ構成
- `docs/config.md` : 環境変数/設定
- `docs/handoff.md` : 引き継ぎ要約

## 更新ルール（短縮版）
- 変更の背景・目的を必ず `docs/decisions.md` に残す
- 未確定要素は `docs/open-questions.md` に追加し、仮定は明示する
- 仕様変更があれば `docs/requirements.md` を更新する
