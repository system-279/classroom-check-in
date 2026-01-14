const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    // 開発用疑似認証（AUTH_MODE=devの場合のみ）
    ...(AUTH_MODE === "dev" && {
      "X-User-Id": "admin-dev",
      "X-User-Role": "admin",
    }),
    ...options.headers,
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "network_error", "ネットワークエラーが発生しました");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? "unknown_error");
  }

  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}
