# 運用チェックリスト

## サービス概要

| サービス | URL | 用途 |
|---------|-----|------|
| API | https://api-102013220292.asia-northeast1.run.app | REST API |
| Web | https://web-102013220292.asia-northeast1.run.app | フロントエンド |
| Notification | https://notification-102013220292.asia-northeast1.run.app | OUT忘れ通知 |
| Docs | https://system-279.github.io/classroom-check-in/ | ドキュメント |

## ヘルスチェックエンドポイント

| サービス | エンドポイント | 説明 |
|---------|---------------|------|
| API | `GET /api/health` | API ヘルスチェック（推奨） |
| API | `GET /health` | API ヘルスチェック（代替） |
| Web | `GET /` | Web トップページ |
| Notification | `GET /health` | Notification ヘルスチェック |

## 日次チェック

- [ ] Cloud Monitoring ダッシュボードで異常がないか確認
- [ ] Uptime Check のステータスが正常か確認
- [ ] Cloud Run のエラーレートを確認（閾値: 1%以下）
- [ ] 直近24時間のログでERRORレベルのエントリを確認

## 週次チェック

- [ ] Cloud Run のリソース使用量を確認（CPU/メモリ）
- [ ] Firestore の使用量・課金を確認
- [ ] BigQuery のスキャンバイト数を確認
- [ ] GitHub Actions の失敗履歴を確認
- [ ] 依存関係のセキュリティアラートを確認

## 月次チェック

- [ ] GCP 請求額の確認
- [ ] Artifact Registry のイメージクリーンアップが機能しているか確認
- [ ] Cloud Run のコールドスタート時間を確認
- [ ] 監査ログの確認

## アラート対応手順

### Uptime Check 失敗時

1. Cloud Run コンソールでサービスの状態を確認
2. Cloud Logging でエラーログを確認
3. サービスが停止している場合:
   ```bash
   gcloud run services describe api --region=asia-northeast1
   gcloud run revisions list --service=api --region=asia-northeast1
   ```
4. 必要に応じて前のリビジョンにロールバック:
   ```bash
   gcloud run services update-traffic api \
     --region=asia-northeast1 \
     --to-revisions=PREVIOUS_REVISION=100
   ```

### エラーレート上昇時

1. Cloud Logging でエラーの詳細を確認:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" \
     --project=classroom-checkin-279 --limit=50
   ```
2. 特定のエンドポイントに集中している場合は該当コードを調査
3. Firestoreのクォータ超過を確認

### メモリ/CPU 過剰使用時

1. Cloud Run のメトリクスを確認
2. 同時実行数の設定を確認
3. メモリリークの可能性がある場合はコードレビュー

## 緊急連絡先

- GCP サポート: https://console.cloud.google.com/support
- GitHub Issues: https://github.com/system-279/classroom-check-in/issues

## 監視設定

### Cloud Monitoring Uptime Check

```bash
# API ヘルスチェック（5分間隔）
gcloud monitoring uptime create api-health-check \
  --display-name="API Health Check" \
  --resource-type=cloud-run-revision \
  --resource-labels=service_name=api,location=asia-northeast1 \
  --path=/api/health \
  --check-interval=300
```

### アラートポリシー（設定済み）

1. **API Uptime Check 失敗**
   - 条件: 5分間チェック失敗
   - 通知先: system@279279.net

2. **Web Uptime Check 失敗**
   - 条件: 5分間チェック失敗
   - 通知先: system@279279.net

3. **Notification Uptime Check 失敗**
   - 条件: 5分間チェック失敗
   - 通知先: system@279279.net

### アラートポリシー（推奨・未設定）

1. **エラーレート上昇**
   - 条件: 5xxエラー率 > 1%（5分平均）
   - 通知チャネル: メール

2. **レイテンシ上昇**
   - 条件: p95レイテンシ > 5秒（5分平均）
   - 通知チャネル: メール

## ロールバック手順

### Cloud Run サービス

```bash
# 現在のリビジョン確認
gcloud run revisions list --service=api --region=asia-northeast1 --limit=5

# 前のリビジョンにロールバック
gcloud run services update-traffic api \
  --region=asia-northeast1 \
  --to-revisions=api-00035-xxx=100

# Webサービスも同様
gcloud run services update-traffic web \
  --region=asia-northeast1 \
  --to-revisions=web-00035-xxx=100
```

### GitHub Actionsでの再デプロイ

1. 前のコミットにrevert
2. PRを作成してマージ
3. または手動でCloud Runにデプロイ:
   ```bash
   gcloud run deploy api \
     --image=asia-northeast1-docker.pkg.dev/classroom-checkin-279/classroom-check-in/api:latest \
     --region=asia-northeast1
   ```

## デモモード

デモモードは認証不要の読み取り専用モードです。

- URL: https://web-102013220292.asia-northeast1.run.app/demo/admin
- API: `DEMO_ENABLED=true` で有効化
- 制限: POST/PATCH/DELETE/PUT は403エラー

## 参考ドキュメント

- [アーキテクチャ](./architecture.md)
- [設定](./config.md)
- [データモデル](./data-model.md)
- [設計判断（ADR）](./decisions.md)
