# 外部連携

## Google Classroom API
- 目的: 講座情報、受講者リスト、課題/テスト情報の取得
- 主要利用先:
  - courses: 講座の一覧と基本情報（リンク含む）
  - courses.students / courses.teachers: 参加者情報
  - courseWork / studentSubmissions: テスト提出時間からOUT推定
- 参考:
  - https://developers.google.com/classroom
  - https://developers.google.com/classroom/reference/rest/v1/courses
  - https://developers.google.com/workspace/classroom/reference/rest/v1/courses/list
  - https://developers.google.com/workspace/classroom/reference/rest/v1/courses.students/list
  - https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork/list

### 留意点
- Classroom API自体には出席/滞在時間の直接的な情報は含まれない想定
- OUT推定は課題提出などの周辺情報から補完する
- ドメイン全体の同期にはドメインワイドデリゲーションが必要な場合がある
- 主なスコープ（read-only想定）:
  - https://www.googleapis.com/auth/classroom.courses.readonly
  - https://www.googleapis.com/auth/classroom.rosters.readonly
  - https://www.googleapis.com/auth/classroom.coursework.readonly
  - https://www.googleapis.com/auth/classroom.profile.emails
  - https://www.googleapis.com/auth/classroom.profile.photos

## Google Forms API
- 目的: テスト（Googleフォーム）提出時間の取得
- 主要利用先:
  - forms.responses.list / forms.responses
- 参考:
  - https://developers.google.com/forms/api
  - https://developers.google.com/workspace/forms/api/reference/rest/v1/forms.responses
  - https://developers.google.com/workspace/forms/api/reference/rest/v1/forms.responses/list

### 主なスコープ（read-only想定）
- https://www.googleapis.com/auth/forms.responses.readonly

### 留意点
- Classroomの課題とフォームIDの紐づけ方法を確立する必要

## 動画プレイヤー/配信プラットフォーム
- 目的: 視聴開始/終了、再生位置、再生速度、シーク操作を取得
- 主要利用先:
  - 埋め込みプレイヤーのイベントAPI（YouTube IFrame APIやHTML5 video）
  - 自前プレイヤーの場合はイベントを直接送信
- 留意点:
  - 外部アプリ/直リンク視聴は計測不可になるため埋め込み必須
  - 再生速度の変更はAPIで検知し、1x以外は無効化する運用が必要
  - 視聴完了判定は「視聴区間の連結」と「速度の正当性」を条件にする

## Admin Reports API (Activity audit)
- 目的: 監査ログからClassroomイベントを補助的に取得
- 主要利用先:
  - activities.list の applicationName に classroom を指定
- 参考:
  - https://developers.google.com/workspace/admin/reports/reference/rest/v1/activities/list

### 留意点
- 取得できるイベント種別は実データで検証が必要
- 参加開始/終了を直接表すイベントがない場合は補助的な位置づけ

## Google OAuth
- 目的: Googleアカウントでのログイン/認可
- 参考:
  - https://developers.google.com/identity/protocols/oauth2

## 通知サービス
- 目的: OUT忘れなどのリマインド通知
- 候補: SendGrid / Gmail API / Workspace SMTP

## (任意) Google Meet API
- 目的: 会議参加の開始/終了時刻を取得
- 主要利用先:
  - conferenceRecords
  - conferenceRecords.participants
  - conferenceRecords.participants.participantSessions (startTime/endTime)
- 参考:
  - https://developers.google.com/meet/api
  - https://developers.google.com/meet/api/reference/rest/v2/conferenceRecords.participants.participantSessions

### 留意点
- Classroomの講座とMeetの会議の紐づけ方法を確立する必要
- 参加者の識別にメールアドレス/ユーザーIDを使う想定
