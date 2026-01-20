"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthenticatedFetch } from "@/lib/hooks/use-authenticated-fetch";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev";

type SelfCheckoutInfo = {
  session: {
    id: string;
    courseId: string;
    userId: string;
    startTime: string;
    status: string;
  };
  course: {
    id: string;
    name: string;
    requiredWatchMin: number;
  };
  notificationSent: boolean;
  notificationSentAt: string | null;
  canCheckout: boolean;
  hasRequiredTime: boolean;
  minEndTime: string;
};

type SelfCheckoutResponse = {
  session: {
    id: string;
    courseId: string;
    userId: string;
    startTime: string;
    endTime: string;
    durationSec: number;
    status: string;
  };
};

/**
 * 日本時間でdatetime-local用フォーマットに変換
 */
function toJSTDateTimeLocal(date: Date): string {
  // 日本時間に変換
  const jstOffset = 9 * 60; // UTC+9
  const utcTime = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
  const jstTime = new Date(utcTime + jstOffset * 60 * 1000);

  const year = jstTime.getFullYear();
  const month = String(jstTime.getMonth() + 1).padStart(2, "0");
  const day = String(jstTime.getDate()).padStart(2, "0");
  const hours = String(jstTime.getHours()).padStart(2, "0");
  const minutes = String(jstTime.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * datetime-local値をUTC ISOStringに変換（日本時間として解釈）
 */
function jstDateTimeLocalToISO(value: string): string {
  // 入力値を日本時間として解釈
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);

  // 日本時間の日時オブジェクトを作成（UTC-9として計算）
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours - 9, minutes, 0, 0));

  return utcDate.toISOString();
}

/**
 * 日本時間で表示用にフォーマット
 */
function formatJSTDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * セルフチェックアウト画面
 * OUT忘れ通知を受け取った受講者が退室時刻を指定して退室打刻できる
 */
export default function SelfCheckoutPage() {
  const params = useParams();
  const { tenantId } = useTenant();
  const sessionId = Array.isArray(params.sessionId)
    ? params.sessionId[0]
    : params.sessionId;

  const { authFetch, authLoading, isAuthenticated, isDemo } = useAuthenticatedFetch();
  const { signInWithGoogle, user } = useAuth();

  const [info, setInfo] = useState<SelfCheckoutInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [endTimeValue, setEndTimeValue] = useState<string>("");

  // 入力可能な時刻範囲を計算
  const { minDateTime, maxDateTime, defaultDateTime } = useMemo(() => {
    if (!info) {
      return { minDateTime: "", maxDateTime: "", defaultDateTime: "" };
    }

    const minEndTime = new Date(info.minEndTime);
    const now = new Date();
    // 現在時刻を超える場合は現在時刻を使用
    const defaultTime = now > minEndTime ? now : minEndTime;

    return {
      minDateTime: toJSTDateTimeLocal(minEndTime),
      maxDateTime: toJSTDateTimeLocal(now),
      defaultDateTime: toJSTDateTimeLocal(defaultTime),
    };
  }, [info]);

  // 初期値設定
  useEffect(() => {
    if (defaultDateTime && !endTimeValue) {
      setEndTimeValue(defaultDateTime);
    }
  }, [defaultDateTime, endTimeValue]);

  // 情報取得
  useEffect(() => {
    // デモモードでは認証チェックをスキップ
    if (!isDemo) {
      // Firebase認証モードで認証確認中は待機
      if (AUTH_MODE === "firebase" && authLoading) {
        return;
      }
    }

    if (!sessionId) {
      setError("セッションIDが指定されていません");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await authFetch<SelfCheckoutInfo>(
          `/api/v1/sessions/self-checkout/${sessionId}/info`
        );
        setInfo(data);
      } catch (e) {
        const message = e instanceof Error ? e.message : "データの取得に失敗しました";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    // 認証済み、またはデモモードの場合のみフェッチ
    if (isAuthenticated || isDemo) {
      fetchData();
    }
  }, [sessionId, authLoading, isAuthenticated, isDemo, authFetch]);

  // セルフチェックアウト実行
  const handleCheckout = async () => {
    if (!info || !endTimeValue) return;

    setActionLoading(true);
    setError(null);

    try {
      const endTimeISO = jstDateTimeLocalToISO(endTimeValue);

      await authFetch<SelfCheckoutResponse>("/api/v1/sessions/self-checkout", {
        method: "POST",
        body: JSON.stringify({
          sessionId: info.session.id,
          endTime: endTimeISO,
        }),
      });

      setSuccess(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "退室打刻に失敗しました";
      setError(message);
    } finally {
      setActionLoading(false);
    }
  };

  // 認証確認中
  if (AUTH_MODE === "firebase" && authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">認証確認中...</div>
      </div>
    );
  }

  // 未ログイン時のログイン画面
  if (AUTH_MODE === "firebase" && !isDemo && !user) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>ログインが必要です</CardTitle>
            <CardDescription>
              退室打刻を行うにはGoogleアカウントでログインしてください。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={signInWithGoogle} className="w-full">
              Googleでログイン
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              ログイン後、この画面に戻ります
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 読み込み中
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  // 成功画面
  if (success) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">退室打刻完了</CardTitle>
            <CardDescription>
              退室時刻が記録されました。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/${tenantId}/student/courses`}>
              <Button className="w-full">講座一覧に戻る</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // エラー（情報取得失敗）
  if (error && !info) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
        <Link href={`/${tenantId}/student/courses`}>
          <Button variant="outline">講座一覧に戻る</Button>
        </Link>
      </div>
    );
  }

  // 情報がない場合
  if (!info) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          セッション情報を取得できませんでした
        </div>
        <Link href={`/${tenantId}/student/courses`}>
          <Button variant="outline">講座一覧に戻る</Button>
        </Link>
      </div>
    );
  }

  // チェックアウト不可の理由を表示
  const renderRestriction = () => {
    if (info.session.status !== "open") {
      return (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800">
          このセッションは既に終了しています。
        </div>
      );
    }

    if (!info.notificationSent) {
      return (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800">
          <p className="font-medium">まだセルフチェックアウトはできません</p>
          <p className="mt-1 text-sm">
            OUT忘れ通知が送信された後にセルフチェックアウトが可能になります。
          </p>
        </div>
      );
    }

    if (!info.hasRequiredTime) {
      return (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800">
          <p className="font-medium">まだセルフチェックアウトはできません</p>
          <p className="mt-1 text-sm">
            必要視聴時間（{info.course.requiredWatchMin}分）が経過するまでお待ちください。
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${tenantId}/student/courses`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 講座一覧に戻る
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>退室打刻</CardTitle>
          <CardDescription>
            退室時刻を指定してセッションを終了します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* セッション情報 */}
          <div className="space-y-2 rounded-lg border p-4">
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
              <span className="text-muted-foreground">講座名:</span>
              <span className="font-medium">{info.course.name}</span>

              <span className="text-muted-foreground">入室時刻:</span>
              <span>{formatJSTDateTime(info.session.startTime)}</span>

              <span className="text-muted-foreground">必要視聴時間:</span>
              <span>{info.course.requiredWatchMin}分</span>

              <span className="text-muted-foreground">状態:</span>
              <span>
                {info.session.status === "open" ? (
                  <span className="text-green-600">進行中</span>
                ) : (
                  <span className="text-gray-500">終了済み</span>
                )}
              </span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
              {error}
            </div>
          )}

          {/* 制限表示 */}
          {renderRestriction()}

          {/* チェックアウトフォーム */}
          {info.canCheckout && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="endTime">退室時刻を入力</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={endTimeValue}
                  onChange={(e) => setEndTimeValue(e.target.value)}
                  min={minDateTime}
                  max={maxDateTime}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  ※ 入室から{info.course.requiredWatchMin}分以上経過後の時刻を指定してください
                </p>
              </div>

              <Button
                onClick={handleCheckout}
                disabled={actionLoading || !endTimeValue}
                className="w-full max-w-xs"
              >
                {actionLoading ? "処理中..." : "退室を確定する"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
