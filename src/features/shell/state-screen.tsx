import type { ReactNode } from "react";
import SiteHeader from "./site-header";

/** 오류·없는 페이지 같은 전체 화면 안내: 세이지 종이 위 흰 카드 하나. */
export default function StateScreen({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper text-bark [color-scheme:light]">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-rule bg-white p-8 text-center shadow-card">
          <h1 className="text-xl font-semibold tracking-[-0.02em] break-keep">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 break-keep text-lichen">
            {description}
          </p>
          {children && (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {children}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
