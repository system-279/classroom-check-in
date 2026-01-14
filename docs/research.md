# 調査メモ（2026/01/13想定）

> **注**: この調査メモは履歴として残しています。以下のAPIは実装しないことが決定済みです（ADR-0005, ADR-0006, ADR-0013, ADR-0014, ADR-0015参照）。

## 目的
Google Classroomの入退室管理を実現するため、Classroom/Reports/Forms APIの利用可能性を整理。

## 主要な一次情報
- Google Classroom APIは講座/課題/メンバー管理のAPIとして提供されている
  - https://developers.google.com/classroom
  - https://developers.google.com/classroom/reference/rest/v1/courses
- Classroom APIの主要リソースは courses / courseWork / studentSubmissions であり、入退室ログ取得の専用リソースは見当たらない
  - https://developers.google.com/workspace/classroom/reference/rest/v1/courses
  - https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork
  - https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork.studentSubmissions
- Google Meet APIは会議スペースや会議記録（conferenceRecords）を扱い、参加セッション（participantSessions）に startTime/endTime を含む（任意）
  - https://developers.google.com/meet/api
  - https://developers.google.com/meet/api/reference/rest/v2/conferenceRecords.participants.participantSessions
- Admin Reports APIは監査ログ取得のAPIで、applicationNameに classroom/meet を指定可能
  - https://developers.google.com/workspace/admin/reports/reference/rest/v1/activities/list
- Google Forms APIは回答の作成時刻/最終提出時刻を取得できるため、テスト提出時間の取得に使える可能性がある
  - https://developers.google.com/forms/api
  - https://developers.google.com/workspace/forms/api/reference/rest/v1/forms.responses
  - https://developers.google.com/workspace/forms/api/reference/rest/v1/forms.responses/list

## まとめ（現時点の解釈）
- Classroom APIだけでIN/OUTを直接取得するのは困難
- Meet APIの participantSessions で参加開始/終了を取得できる可能性が高い（任意）
- Reports APIは補助情報として有用だが、イベント種別は実データでの検証が必要
- 動画視聴の計測はプレイヤー側イベントの実装に依存するため、別途調査が必要
- Forms APIの回答時刻はOUT推定の補助に使える可能性がある
 - Classroom課題とFormsのフォームIDの自動紐づけは、公式仕様としては明記されていない

## 追加調査候補
- Classroom講座とMeet会議の紐づけ方法（ID/リンク/カレンダー）
- Meet APIのスコープ/権限要件
- Reports APIで取得できるMeet/Classroomイベントの詳細
- 動画プラットフォーム（YouTube/自前）の計測APIと制限
- 再生速度/シーク制御の可否と制約
- Classroomの課題とGoogle FormsのフォームIDの紐づけ方法
