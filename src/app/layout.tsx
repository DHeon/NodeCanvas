import type { Metadata } from "next";
import {
  Gaegu,
  Geist,
  Geist_Mono,
  Gowun_Batang,
  Nanum_Gothic_Coding,
} from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 텍스트 노드 글꼴(명조·손글씨·고정폭). 한글은 글자 범위별 파일로 나뉘어 있어
// 미리 내려받지 않고(preload: false) 화면에 쓰인 글자 범위만 받는다.
const gowunBatang = Gowun_Batang({
  variable: "--font-gowun-batang",
  weight: ["400", "700"],
  preload: false,
  display: "swap",
});
const gaegu = Gaegu({
  variable: "--font-gaegu",
  weight: ["400", "700"],
  preload: false,
  display: "swap",
});
const nanumCoding = Nanum_Gothic_Coding({
  variable: "--font-nanum-coding",
  weight: ["400", "700"],
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: "nono",
  description: "노드 기반 작업 공간.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} ${gowunBatang.variable} ${gaegu.variable} ${nanumCoding.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
