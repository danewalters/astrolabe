import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource/noto-serif-sc/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "玄机 AI · 东方命理工作台",
  description: "以八字、紫微斗数和周易六爻探索传统命盘，用 DeepSeek 生成带盘面依据的反思与行动建议。",
  icons: { icon: "/astrolabe.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
