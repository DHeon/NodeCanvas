import type { ReactNode } from "react";
import Link from "next/link";

const weekData = {
  number: "01",
  title: "Mote의 개발 기반을 만들었습니다.",
  summary:
    "Next.js 프로젝트 구조와 기본 라우팅을 구성하고, 앞으로의 개발 기반을 마련했습니다.",
  completed: [
    "Next.js App Router 프로젝트 생성",
    "TypeScript, Tailwind CSS, ESLint, Prettier 설정",
    "React Compiler 활성화",
    "Git week-01 브랜치 생성",
    "메인, 로그인, 회원가입, 대시보드 라우팅",
  ],
  stack: [
    ["Runtime", "Node.js 24.19.0 / npm 12.0.2"],
    ["Framework", "Next.js 16.3.4 / React 19.2.8"],
    ["Language", "TypeScript 5"],
    ["Style", "Tailwind CSS 4"],
    ["Quality", "ESLint 9 / Prettier"],
    ["Version control", "Git"],
  ],
  next: "PostgreSQL과 Prisma를 연결하고 프로젝트 데이터 모델을 설계합니다.",
};

const screenshots = [
  ["메인 화면", "/pres/week1/main.png"],
  ["로그인 화면", "/pres/week1/login.png"],
  ["대시보드", "/pres/week1/dashboard.png"],
];

function Section({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-white/10 py-20">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-xs tracking-[0.25em] text-violet-300">{label}</p>
        <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">{title}</h2>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

export default function Week1Page() {
  return (
    <main>
      <section className="flex min-h-[calc(100vh-4rem)] items-center">
        <div className="mx-auto w-full max-w-7xl px-6 py-20">
          <p className="text-sm tracking-[0.3em] text-violet-300">
            WEEK {weekData.number} / FOUNDATION
          </p>

          <h1 className="mt-6 max-w-4xl text-5xl leading-tight font-semibold sm:text-7xl">
            {weekData.title}
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-8 text-neutral-400">
            {weekData.summary}
          </p>

          <Link
            href="/dashboard"
            className="mt-10 inline-flex rounded-xl border border-violet-300/40 px-5 py-3 text-violet-200 hover:bg-violet-400/10"
          >
            제품 화면 열기 →
          </Link>
        </div>
      </section>

      <Section label="01 / DONE" title="이번 주에 한 일">
        <div className="grid gap-3 md:grid-cols-2">
          {weekData.completed.map((item, index) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 bg-neutral-900 p-5"
            >
              <span className="text-sm text-violet-300">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-3 text-neutral-300">{item}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section label="02 / ENVIRONMENT" title="개발 환경">
        <div className="grid overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 sm:grid-cols-2">
          {weekData.stack.map(([label, value]) => (
            <div key={label} className="border-b border-white/10 p-5">
              <p className="text-xs tracking-[0.2em] text-neutral-500">
                {label}
              </p>
              <p className="mt-2 font-mono text-sm text-neutral-200">
                {value}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section label="03 / SCREENSHOTS" title="이번 주 화면">
        <div className="grid gap-5 md:grid-cols-3">
          {screenshots.map(([title, path]) => (
            <figure
              key={title}
              className="overflow-hidden rounded-2xl border border-dashed border-white/20 bg-neutral-900"
            >
              <div className="flex aspect-[4/3] items-center justify-center bg-neutral-800 p-5 text-center">
                <div>
                  <p className="text-sm text-neutral-300">{title}</p>
                  <code className="mt-2 block text-xs text-neutral-500">
                    {path}
                  </code>
                </div>
              </div>

              <figcaption className="border-t border-white/10 px-4 py-3 text-xs text-neutral-500">
                캡처 이미지를 위 경로에 추가
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section label="04 / NEXT" title="다음 주 계획">
        <div className="rounded-2xl border border-violet-300/20 bg-violet-300/5 p-6">
          <p className="text-lg leading-8 text-neutral-200">{weekData.next}</p>
        </div>
      </Section>

      <footer className="mx-auto flex max-w-7xl justify-between px-6 py-12 text-sm text-neutral-500">
        <span>MOTE / WEEK {weekData.number}</span>
        <Link href="/pres" className="hover:text-white">
          발표 목록으로
        </Link>
      </footer>
    </main>
  );
}