import type { Metadata } from "next";
import Link from "next/link";
import { storage, workflows } from "./content";

export const metadata: Metadata = {
  title: "Nono | 9주차 캔버스 노드와 하위 작업 공간",
  description: "캔버스 노드 생성, 하위 공간 탐색, 카메라 복원과 문서 저장 흐름",
};

export default function Week9Page() {
  return (
    <main
      id="top"
      className="min-h-screen bg-neutral-950 px-5 text-neutral-100 selection:bg-violet-500/40 sm:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header className="py-12 sm:py-16">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <p className="font-mono tracking-widest text-violet-300">
              NONO / WEEK 09
            </p>
            <Link
              href="/pres/week8"
              className="text-neutral-400 hover:text-white"
            >
              8주차 발표
            </Link>
          </div>
          <div className="mt-8 grid items-center gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:gap-12">
            <div>
              <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
                캔버스 노드와
                <br className="hidden sm:block" /> 하위 작업 공간
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-neutral-300">
                작업 공간 안의 노드가 또 하나의 작업 공간을 담는다.
              </p>
            </div>
            <figure className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5 sm:p-6">
              <figcaption className="text-xs font-medium tracking-widest text-violet-300">
                문서 구조 예시
              </figcaption>
              <ul className="mt-4 text-sm leading-7">
                <li>
                  <span className="font-medium">루트 작업 공간</span>
                  <ul className="mt-1 space-y-1 border-l border-neutral-700 pl-4">
                    <li className="text-neutral-300">
                      텍스트 노드 · 전체 기획
                    </li>
                    <li>
                      <span className="font-medium text-violet-200">
                        캔버스 노드 · 자료 정리
                      </span>
                      <ul className="border-l border-violet-500/40 pl-4 text-neutral-300">
                        <li>하위 문서 · 노드, 연결선, 캔버스 설정</li>
                      </ul>
                    </li>
                  </ul>
                </li>
              </ul>
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
            href="#storage"
            className="shrink-0 text-sm text-neutral-300 hover:text-violet-200"
          >
            <span className="mr-2 font-mono text-violet-300">05</span>
            데이터 보관 위치
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
          id="storage"
          aria-labelledby="storage-title"
          className="scroll-mt-20 py-12 sm:py-16"
        >
          <p className="font-mono text-sm tracking-widest text-violet-300">
            05
          </p>
          <h2
            id="storage-title"
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            데이터 보관 위치
          </h2>
          <dl className="mt-7 divide-y divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900/50">
            {storage.map(({ label, location, detail }) => (
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
          <p>NONO / 9주차 작업 공간</p>
          <a href="#top" className="hover:text-white">
            맨 위로
          </a>
        </footer>
      </div>
    </main>
  );
}
