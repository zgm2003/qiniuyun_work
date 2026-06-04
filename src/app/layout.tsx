import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 小说转剧本工具",
  description: "将 3 个章节以上小说转换为可校验 YAML 剧本初稿"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
