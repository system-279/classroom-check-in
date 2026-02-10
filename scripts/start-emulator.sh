#!/bin/bash
# Firestoreエミュレータ起動スクリプト

echo "=== Firestoreエミュレータ起動 ==="
echo "▶ ポート: 8081"
echo "▶ UI: http://localhost:4000"
echo ""

firebase emulators:start --only firestore
