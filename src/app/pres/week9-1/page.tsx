import type { Metadata } from "next";
import Link from "next/link";
import { changes, workflows } from "./content";

export const metadata: Metadata = {
  title: "Nono | 9주차 추가 · 자동 저장과 편집 조작",
  description:
    "자동 저장, 충돌 복구, 키보드 조작, 보기 설정(각진 선·점 배경), 연결선 색, 가입 흐름",
};

const summary = [
  ["저장", "자동 저장 · 충돌 복구"],
  ["조작", "단축키 · 트랙패드 · 이미지 크게 보기"],
  ["보기", "각진 선 · 점 배경 · 선 색 · 글자 스타일"],
  ["화면", "가입 흐름 · 대시보드 · 디자인 통일"],
];

export default function Week9ExtraPage() {
  return (
    <main
      id="top"
      className="min-h-screen bg-neutral-950 px-5 text-neutral-100 selection:bg-violet-500/40 sm:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header className="py-12 sm:py-16">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <p className="font-mono tracking-widest text-violet-300">
              NONO / WEEK 09 · 추가
            </p>
            <Link
              href="/pres/week9"
              className="text-neutral-400 hover:text-white"
            >
              9주차 발표
            </Link>
          </div>
          <div className="mt-8 grid items-center gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:gap-12">
            <div>
              <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
                손을 떼면 저장되고,
                <br className="hidden sm:block" /> 키보드로도 정리한다
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-neutral-300">
                9주차 하위 작업 공간 이후에 더한 기능을 사용자 조작 순서대로
                따라간다.
              </p>
            </div>
            <figure className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5 sm:p-6">
              <figcaption className="text-xs font-medium tracking-widest text-violet-300">
                이번에 추가한 것
              </figcaption>
              <dl className="mt-4 space-y-3 text-sm leading-6">
                {summary.map(([group, items]) => (
                  <div key={group} className="grid grid-cols-[3rem_1fr] gap-3">
                    <dt className="font-medium text-violet-200">{group}</dt>
                    <dd className="text-neutral-300">{items}</dd>
                  </div>
                ))}
              </dl>
            </figure>
          </div>
        </header>

        <nav
          aria-label="발표 목차"
          className="sticky top-0 z-30 -mx-5 flex gap-5 overflow-x-auto border-y border-neutral-800 bg-neutral-950/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8"
        >
          {workflows.map((flow, index) => (
            <a
              key={flow.id}
              href={`#${flow.id}`}
              className="shrink-0 text-sm text-neutral-300 hover:text-violet-200"
            >
              <span className="mr-2 font-mono text-violet-300">
                {String(index + 1).padStart(2, "0")}
              </span>
              {flow.title}
            </a>
          ))}
          <a
            href="#changes"
            className="shrink-0 text-sm text-neutral-300 hover:text-violet-200"
          >
            <span className="mr-2 font-mono text-violet-300">
              {String(workflows.length + 1).padStart(2, "0")}
            </span>
            새로 저장되는 값
          </a>
        </nav>

        {workflows.map((flow, index) => (
          <section
            key={flow.id}
            id={flow.id}
            aria-labelledby={`${flow.id}-title`}
            className="scroll-mt-20 border-b border-neutral-800 py-12 sm:py-16"
          >
            <p className="font-mono text-sm tracking-widest text-violet-300">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h2
              id={`${flow.id}-title`}
              className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              {flow.title}
            </h2>
            <div className="mt-6 border-l-2 border-violet-400 pl-5">
              <p className="text-sm text-violet-300">사용자 조작</p>
              <p className="mt-2 text-lg leading-7">{flow.action}</p>
              <p className="mt-1 leading-7 text-neutral-400">{flow.result}</p>
            </div>
            <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-neutral-400">
                  실행 순서
                </h3>
                <ol className="mt-5 ml-3 space-y-5">
                  {flow.steps.map((step, stepIndex) => (
                    <li
                      key={step.fn}
                      className="relative border-l border-neutral-700 pl-6"
                    >
                      <span className="absolute top-0 -left-3 grid h-6 w-6 place-items-center rounded-full border border-neutral-700 bg-neutral-950 font-mono text-xs text-violet-300">
                        {stepIndex + 1}
                      </span>
                      <h4 className="font-mono text-sm leading-6 break-words">
                        {step.fn}
                      </h4>
                      <p className="mt-1 leading-7 text-neutral-300">
                        {step.detail}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
              <figure className="min-w-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/65">
                <figcaption className="border-b border-neutral-800 px-5 py-4">
                  <p className="text-sm font-medium">핵심 코드</p>
                  <p className="mt-1 font-mono text-xs leading-5 break-all text-violet-300">
                    {flow.file}
                  </p>
                </figcaption>
                <pre
                  tabIndex={0}
                  aria-label={`${flow.title} 코드 발췌`}
                  className="overflow-x-auto px-5 py-4 text-sm leading-6 text-violet-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet-400"
                >
                  <code>{flow.code}</code>
                </pre>
              </figure>
            </div>
          </section>
        ))}

        <section
          id="changes"
          aria-labelledby="changes-title"
          className="scroll-mt-20 py-12 sm:py-16"
        >
          <p className="font-mono text-sm tracking-widest text-violet-300">
            {String(workflows.length + 1).padStart(2, "0")}
          </p>
          <h2
            id="changes-title"
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            새로 저장되는 값
          </h2>
          <dl className="mt-7 divide-y divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900/50">
            {changes.map(({ label, location, detail }) => (
              <div
                key={label}
                className="grid gap-2 p-5 sm:grid-cols-[13rem_1fr] sm:gap-5"
              >
                <dt className="font-medium">{label}</dt>
                <dd>
                  <code className="text-sm text-violet-200">{location}</code>
                  <p className="mt-1 leading-7 text-neutral-300">{detail}</p>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="flex flex-wrap justify-between gap-4 border-t border-neutral-800 py-8 text-sm text-neutral-400">
          <p>NONO / 9주차 추가 기능</p>
          <a href="#top" className="hover:text-white">
            맨 위로
          </a>
        </footer>
      </div>
    </main>
  );
}
