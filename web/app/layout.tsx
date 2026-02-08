import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "swiss config",
  description: "swiss configuration UI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}