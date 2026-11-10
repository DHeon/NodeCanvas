import Link from "next/link";
import type { ReactNode } from "react";
import SiteHeader, { SkipLink } from "@/features/shell/site-header";

type AuthShellProps = {
  title: string;
  description: string;
  alternate: { prompt: string; href: string; label: string };
  children: ReactNode;
};

/** 로그인·회원가입 공통 틀: 워드마크 헤더, 가운데 흰 카드, 아래 전환 링크. */
export default function AuthShell({
  title,
  description,
  alternate,
  children,
}: AuthShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper text-bark [color-scheme:light]">
      <SkipLink />
      <SiteHeader />
      <main
        id="main-content"
        className="flex flex-1 items-start justify-center px-4 py-12 sm:items-center sm:py-16"
      >
        <div className="w-full max-w-[400px]">
          <div className="rounded-2xl border border-rule bg-white p-6 shadow-card sm:p-8">
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">
              {title}
            </h1>
            <p className="mt-2 mb-7 text-sm leading-6 break-keep text-lichen">
              {description}
            </p>
            {children}
          </div>
          <p className="mt-5 text-center text-sm text-lichen">
            {alternate.prompt}{" "}
            <Link
              href={alternate.href}
              className="rounded-sm font-medium text-bark-soft underline underline-offset-4 hover:text-bark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep"
            >
              {alternate.label}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
