"use client";

import Link from "next/link";
import { TenantProvider } from "@/lib/tenant-context";
import { AuthProvider } from "@/lib/auth-context";
import { AuthFetchProvider } from "@/lib/auth-fetch-context";

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TenantProvider tenantId="demo">
      <AuthProvider>
        <AuthFetchProvider>
          <div className="min-h-screen bg-background">
            {/* デモモードバナー */}
            <div className="bg-yellow-100 border-b border-yellow-300 text-yellow-800 text-center py-2 text-sm">
              デモモード（読み取り専用） - データの閲覧のみ可能です
            </div>
            <header className="border-b bg-card">
              <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
                <Link href="/demo" className="font-semibold text-blue-600">
                  Classroom Check-in (DEMO)
                </Link>
                <nav className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">|</span>
                  <Link
                    href="/demo/admin"
                    className="text-muted-foreground hover:text-foreground font-medium"
                  >
                    管理者向け
                  </Link>
                  <Link
                    href="/demo/student"
                    className="text-muted-foreground hover:text-foreground font-medium"
                  >
                    受講者向け
                  </Link>
                </nav>
              </div>
            </header>
            <main className="mx-auto max-w-7xl p-4">{children}</main>
          </div>
        </AuthFetchProvider>
      </AuthProvider>
    </TenantProvider>
  );
}
