#!/bin/bash
# APIサーバー起動スクリプト（開発モード）

echo "=== APIサーバー起動（開発モード） ==="
echo "▶ URL: http://localhost:8080"
echo "▶ AUTH_MODE: dev（ヘッダー疑似認証）"
echo "▶ FIRESTORE_EMULATOR_HOST: localhost:8081"
echo ""

export AUTH_MODE=dev
export FIRESTORE_EMULATOR_HOST=localhost:8081
export GCLOUD_PROJECT=classroom-checkin-279
export FIREBASE_PROJECT=classroom-checkin-279

npm run start -w @classroom-check-in/api
