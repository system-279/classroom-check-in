# E2Eテスト実行ガイド（Firestoreエミュレータ使用）

## 前提条件

- Firebaseエミュレータがインストールされていること
- API・Webサーバーがローカルで起動可能なこと

## 環境変数

```bash
# 必須: Firestoreエミュレータ
export FIRESTORE_EMULATOR_HOST=localhost:8081

# API設定
export AUTH_MODE=dev
export API_BASE_URL=http://localhost:8080  # デフォルト値

# Web設定
export NEXT_PUBLIC_AUTH_MODE=dev
export NEXT_PUBLIC_API_URL=http://localhost:8080  # デフォルト値
```

## 実行手順

### 1. Firestoreエミュレータ起動

```bash
# ターミナル1
firebase emulators:start --only firestore
```

エミュレータUIは http://localhost:4000 で確認可能

### 2. APIサーバー起動

```bash
# ターミナル2
cd services/api
export AUTH_MODE=dev
export FIRESTORE_EMULATOR_HOST=localhost:8081
npm start
```

### 3. Webサーバー起動

```bash
# ターミナル3
cd web
export NEXT_PUBLIC_AUTH_MODE=dev
npm run dev
```

### 4. E2Eテスト実行

```bash
# ターミナル4
export FIRESTORE_EMULATOR_HOST=localhost:8081
npx playwright test e2e/check-in-out-flow.spec.ts
```

## テストシナリオ

1. 講座一覧表示確認
2. 入室（IN）→ セッション作成
3. heartbeat送信確認
4. 退室（OUT）→ セッション終了（1分待機）
5. 管理画面でセッション表示確認

## トラブルシューティング

### `FIRESTORE_EMULATOR_HOST is not set`

エミュレータが起動していないか、環境変数が設定されていません。

```bash
export FIRESTORE_EMULATOR_HOST=localhost:8081
firebase emulators:start --only firestore
```

### 401/403エラー

テナントAPIの認証ヘッダーが不足しています。
`page.route()` で `x-user-email` が正しく注入されているか確認してください。

### check-inが200を返す

既存セッションが残っている可能性があります。
エミュレータを再起動してクリーンな状態にしてください。

### OUTボタンが活性化しない

`requiredWatchMin=1` 分の待機時間が経過していません。
テストタイムアウト（180秒）内に完了するはずですが、環境によっては延長が必要な場合があります。

## クリーンアップ

テストは自動的に以下のデータを削除します：

1. セッション
2. enrollment
3. ユーザー
4. 講座
5. allowed_emails

エミュレータを停止すれば、全データが完全にクリアされます。

## CI/CD統合

GitHub Actionsなどでの実行例：

```yaml
- name: Start Firestore Emulator
  run: firebase emulators:start --only firestore &

- name: Wait for Emulator
  run: sleep 5

- name: Run E2E Tests
  env:
    FIRESTORE_EMULATOR_HOST: localhost:8081
    AUTH_MODE: dev
  run: npx playwright test e2e/check-in-out-flow.spec.ts
```

## 注意事項

- テストは **serial実行**（順序依存）
- 実時間で1分待機するため、実行時間は約2-3分
- テナントIDは動的生成（`test-e2e-${timestamp}`）
- 本番データへの影響は **ゼロ**（エミュレータのみ使用）
