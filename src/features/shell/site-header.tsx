import Link from "next/link";
import type { ReactNode } from "react";

/** 랜딩 밖 화면(인증·대시보드)이 공유하는 상단 막대: 왼쪽 워드마크, 오른쪽 보조 행동. */
export default function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-rule-soft">
      <div className="mx-auto flex h-16 w-[min(1184px,calc(100%-32px))] items-center justify-between gap-6 sm:w-[min(1184px,calc(100%-64px))]">
        <Link
          href="/"
          aria-label="nono 홈"
          className="rounded-md text-2xl font-semibold tracking-[-0.04em] text-bark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-moss-deep"
        >
          nono.
        </Link>
        {children}
      </div>
    </header>
  );
}

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="fixed top-2.5 left-4 z-50 -translate-y-[200%] rounded-lg bg-bark px-4 py-3 text-sm text-white focus:translate-y-0"
    >
      본문으로 건너뛰기
    </a>
  );
}
