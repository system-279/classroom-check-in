# 主要フロー

## 1. 動画視聴ベースの自動IN/OUT
1) 受講者が講座内の動画プレイヤーで視聴開始
2) プレイヤーがPLAY/HEARTBEAT/SEEK/RATE_CHANGE/ENDEDを送信
3) 視聴区間と再生速度を集約してVideoWatchSessionを生成
4) 先頭から最後まで視聴した場合にOUTを確定
5) 視聴途中なら end_time を null のまま保持

## 2. 入室打刻とClassroom遷移
1) Classroom APIで講座一覧と受講者の参加情報を同期
2) 対象講座（CourseTarget）かつ visible=true のみを選択肢として表示
3) 受講者が講座を選択（講座未選択ならIN不可）
4) 入室ボタンでINを打刻
5) Google Classroomの対象講座へ遷移（同一/別タブ）
6) アプリはバックグラウンドでheartbeatを送信
7) タブが非表示/終了した場合、退室打刻を提案

## 3. テスト提出時間からのOUT推定
1) Classroom APIでcourseWorkとstudentSubmissionsを取得
2) 提出時刻をOUT候補としてAttendanceEventを作成
3) 既存セッションに紐づけて end_time を補完

## 4. 動画視聴のみ（手動IN/OUT）
1) 受講者がWeb UIでIN/OUTを入力
2) AttendanceEventとして保存
3) 自動イベントと競合する場合は教員が補正

## 5. OUT忘れ通知
1) Schedulerが未OUTのセッションを検出
2) 通知ポリシー（初回/間隔/最大日数）に従ってメール送信
3) 受講者が後日OUT時刻を手動設定

## 6. 再計算/補正
- IN/OUTの差分を再計算するジョブを日次で実行
- 手動補正があれば最新を優先
