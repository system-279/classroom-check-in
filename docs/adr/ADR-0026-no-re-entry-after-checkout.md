# ADR-0026: 同一講座への再入室禁止

## ステータス
採用

## コンテキスト
現在の仕様では、受講者が退室（check-out）後に同じ講座へ再度入室（check-in）できてしまう。
これにより、1つの講座を複数回受講したように記録される可能性がある。

要件:
- 1回の受講で1セッションのみ許可
- 指定時間（requiredWatchMin）経過前は退室不可（既存仕様）
- 退室後は再入室不可

## 決定
1. **再入室禁止**: 同一講座でclosedセッションが存在する場合、check-inを拒否（403エラー）
2. **受講済み表示**: 退室後は「受講済み」状態を表示し、入室ボタンを非表示
3. **Classroom継続利用**: 「Google Classroomを開く」ボタンは受講済み後も利用可能
4. **管理者リセット**: 管理者がセッションを削除して再入室可能にできる

## 実装詳細

### API変更

#### POST /sessions/check-in
```typescript
// 既存チェック後に追加
const closedSession = await ds.getClosedSessionForCourse(userId, courseId);
if (closedSession) {
  return res.status(403).json({
    error: "already_completed",
    message: "この講座は受講済みです",
    session: closedSession
  });
}
```

#### GET /api/v1/courses レスポンス拡張
```typescript
sessionSummary: {
  hasActiveSession: boolean;
  isCompleted: boolean;      // 追加: closedセッションが存在するか
  sessionCount: number;
  totalDurationSec: number;
  lastSessionAt: string | null;
}
```

#### DELETE /admin/sessions/:id
既存の強制終了とは別に、セッションを完全削除して再入室を可能にする。

### UI変更

#### セッションページ（受講済み状態）
- 「受講済み」バッジ表示
- 入室ボタン非表示
- 「Google Classroomを開く」ボタンは表示

#### 講座一覧
- 受講済み講座に「受講済み」バッジ
- 入室不可を視覚的に表示

#### 管理画面
- セッション削除（リセット）ボタン追加

## 影響

### 既存データへの影響
- 既にclosedセッションを持つユーザーは、この機能リリース後に再入室不可になる
- 必要に応じて管理者がリセット可能

### 関連ADR
- ADR-0012: 連続INの扱い（同一セッション中の連打防止）
- ADR-0023: 同時複数講座セッション禁止

## 代替案
1. **期間制限**: 一定期間後に再入室可能 → 要件と合わない
2. **受講回数制限**: N回まで許可 → 複雑化するため不採用

## 日付
2026-01-29
