import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Classroom Check-in",
  description: "Attendance tracking for Google Classroom.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
