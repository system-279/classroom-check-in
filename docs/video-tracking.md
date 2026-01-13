# 動画視聴トラッキング設計

## 目的
- 視聴開始/終了の判定
- 先頭から最後までの視聴を担保
- 再生速度変更やシークを検知

## 基本方針
- 視聴は埋め込みプレイヤー経由に限定する
- フロントからイベントを送信し、サーバで検証・集約する
- 1x以外の再生速度区間は完走判定に含めない

## クライアントイベント
- PLAY: 再生開始
- PAUSE: 一時停止
- HEARTBEAT: 定期送信（例: 10-30秒）
- SEEK: シーク発生
- RATE_CHANGE: 再生速度変更
- ENDED: 再生完了

### 推奨フィールド
- video_id, course_id, user_id
- event_time (UTC)
- position_sec
- playback_rate
- is_visible (タブ/画面の表示状態)
- client_session_id

## サーバ側集約
- 連続した視聴区間をマージして watched_ranges を生成
- 速度 != 1.0 の区間は除外または invalid 扱い
- watched_ranges の合計 / duration_sec で coverage_ratio を算出
- coverage_ratio が閾値を超えたら完走とみなす

## 例: 完走判定の擬似ルール
- coverage_ratio >= 0.98 かつ normal_speed_ratio >= 0.98
- SEEKが多い場合は信頼度を下げる
- HEARTBEAT欠損が多い場合は再視聴を要求

## 留意点
- 外部動画アプリ/直リンクでは計測不能
- ブラウザ/OSによるイベント制限の差異に注意
- 収集は不正防止の補助であり、完全な保証はできない
- Classroom内での外部動画視聴は、プレイヤーAPIを埋め込まない限り速度/完走を取得できない
