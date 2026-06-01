import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FolderProvider } from "@/contexts/FolderContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { I18nProvider } from "@/i18n";
import SwRegister from "@/components/SwRegister";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Claude Journal",
  description: "Claude Code 对话记录浏览器",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Claude Journal",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <head>
        {/* Prevent theme flash on load */}
        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  var t = localStorage.getItem('claude-journal-theme') || 'system';
  var resolved = t === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : t;
  document.documentElement.classList.remove('dark','light');
  document.documentElement.classList.add(resolved);
})();
        `}} />
      </head>
      <body className="min-h-full flex flex-col">
        <SwRegister />
        <Analytics />
        <SpeedInsights />
        <ThemeProvider>
          <I18nProvider>
            <FolderProvider>{children}</FolderProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
