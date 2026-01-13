# AI開発ガイド

このプロジェクトでは、AIが設計・実装を進めるために、ドキュメントの構造化と差分追跡を重視します。

## 更新時の優先順位
1) `docs/requirements.md` を更新（仕様変更）
2) `docs/decisions.md` に判断理由を記録
3) `docs/open-questions.md` に未解決項目を追加
4) `docs/data-model.md` / `docs/architecture.md` を整合させる
5) 依存更新時は `docs/tech-stack.md` を同期する

## 出力形式
- 仕様は MUST/SHOULD/COULD で表現
- 重要な判断はADRとして記録
- 推定や不確定事項は必ず明記

## AIが確認すべきチェックリスト
- 仕様変更が既存のセッション計算ロジックに影響しないか
- 外部APIの権限/スコープが変更されていないか
- 収集データがプライバシー/契約上問題ないか
