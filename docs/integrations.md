# 外部連携

## 現在使用中

### Gmail API
- 目的: OUT忘れ通知メールの送信
- 利用先: `services/notification/src/gmail-mailer.ts`
- スコープ: `https://www.googleapis.com/auth/gmail.send`
- 認証: サービスアカウント（Domain-wide Delegationで送信者を偽装）

## スコープ外（実装しない）

以下のAPIは実装しない。参考情報として残す。

### ~~Google Classroom API~~ (ADR-0006, ADR-0013)
- 廃止理由: OAuth審査コストが高いため
- 代替: 講座・受講者情報は管理画面で手入力

### ~~Google Forms API~~ (ADR-0005)
- 廃止理由: OAuth審査コストが高いため
- 代替: OUT時刻は手動入力のみ

### ~~動画プレイヤー連携~~ (ADR-0015)
- 廃止理由: 埋め込みプレイヤー実装・運用コストが高いため
- 代替: IN/OUTは手動入力のみ

### ~~Google OAuth~~ (ADR-0014)
- 廃止理由: OAuth審査コストが高いため
- 代替: ヘッダ疑似認証（開発用）で運用

### ~~Google Meet API~~
- 廃止理由: Classroom API連携廃止に伴い不要
