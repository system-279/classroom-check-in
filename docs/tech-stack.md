# 技術スタック（バージョン確定）

## 前提
- 2026-01-16 時点の安定版（公式/レジストリの latest）を採用
- 主要バージョンが更新された場合は本書を更新する

## ランタイム
- Node.js LTS: v24.12.0 (LTS: Krypton)
  - https://nodejs.org/dist/index.json

## フロントエンド
- Next.js: 16.1.1
  - https://registry.npmjs.org/next/latest
- React: 19.2.3
  - https://registry.npmjs.org/react/latest
- React DOM: 19.2.3
  - https://registry.npmjs.org/react-dom/latest
- @types/react: 19.2.8
  - https://registry.npmjs.org/@types/react/latest
- @types/react-dom: 19.2.3
  - https://registry.npmjs.org/@types/react-dom/latest
- TypeScript: 5.9.3
  - https://registry.npmjs.org/typescript/latest

## バックエンド
- Express: 5.2.1
  - https://registry.npmjs.org/express/latest
- @types/express: 5.0.6
  - https://registry.npmjs.org/@types/express/latest
- @types/node: 25.0.7
  - https://registry.npmjs.org/@types/node/latest

## GCP SDK
- @google-cloud/firestore: 8.1.0
  - https://registry.npmjs.org/@google-cloud/firestore/latest
- @google-cloud/bigquery: 8.1.1
  - https://registry.npmjs.org/@google-cloud/bigquery/latest
- googleapis: 170.0.0
  - https://registry.npmjs.org/googleapis/latest

## 備考
- Node/Next/Reactは互換性の影響が大きいため、更新時は検証を必須とする
- 本書のバージョンと実装の依存関係が一致することを要件とする
