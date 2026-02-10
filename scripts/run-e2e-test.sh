#!/bin/bash
# E2Eテスト実行スクリプト
# 前提: FirestoreエミュレータとAPIサーバーが起動していること

set -e

echo "=== E2Eテスト実行準備 ==="

# 環境変数設定
export FIRESTORE_EMULATOR_HOST="localhost:8081"
export API_BASE_URL="http://localhost:8080"
export BASE_URL="http://localhost:3000"
export TEST_TENANT_ID="6shh0riw"
export GCLOUD_PROJECT="classroom-checkin-279"
export FIREBASE_PROJECT="classroom-checkin-279"

# ポート確認
echo "▶ ポート確認中..."
if ! lsof -ti:8081 > /dev/null 2>&1; then
  echo "❌ Firestoreエミュレータ (port 8081) が起動していません"
  echo "   起動コマンド: firebase emulators:start --only firestore"
  exit 1
fi
echo "✅ Firestoreエミュレータ (port 8081) 確認"

if ! lsof -ti:8080 > /dev/null 2>&1; then
  echo "❌ APIサーバー (port 8080) が起動していません"
  echo "   起動コマンド: AUTH_MODE=dev npm run start -w @classroom-check-in/api"
  exit 1
fi
echo "✅ APIサーバー (port 8080) 確認"

# Webサーバー確認（自動起動するので警告のみ）
if ! lsof -ti:3000 > /dev/null 2>&1; then
  echo "ℹ️  Webサーバー (port 3000) は自動起動します"
else
  echo "✅ Webサーバー (port 3000) 確認"
fi

echo ""
echo "=== E2Eテスト実行 ==="
npx playwright test e2e/check-in-out-flow.spec.ts
