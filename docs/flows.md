# 主要フロー

## 1. 入室打刻とClassroom遷移
1. 受講者がWeb UIで講座一覧を表示（enabled=true かつ visible=true のみ）
2. 講座を選択（講座未選択ならIN不可）
3. 入室ボタンでINを打刻（Session作成、status=open）
4. Google Classroomの対象講座へ新規タブで遷移
5. アプリはバックグラウンドでheartbeatを送信（1分間隔）

## 2. 退室打刻
1. 受講者がWeb UIでOUTボタンを押下
2. Sessionのstatus=closed、endTimeを確定
3. 滞在時間（durationSec）を計算

## 3. OUT忘れ通知
1. Cloud Schedulerが毎時0分に通知サービスを起動
2. status=openのセッションを検出
3. lastHeartbeatAtから一定時間経過したセッションを対象に
4. 通知ポリシー（初回/間隔/最大日数）に従ってメール送信
5. 通知ログに記録（重複防止）

## 4. 手動補正
1. 管理者が管理画面でセッション一覧を確認
2. 未退室セッションを選択
3. 強制終了（手動クローズ）を実行
4. AttendanceEventに補正記録を残す
