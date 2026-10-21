import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Multimate Business",
  description: "ליווי עסקי מדיד",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
