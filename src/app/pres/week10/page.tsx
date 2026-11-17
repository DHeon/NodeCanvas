import type { Metadata } from "next";
import Link from "next/link";
import { polish, storage, workflows } from "./content";

export const metadata: Metadata = {
  title: "Nono | 10주차 태그 · 검색 · 연결 · 체크리스트",
  description:
    "노드 태그와 태그 미리보기, 하위 캔버스까지 찾는 검색, 여러 노드 한꺼번에 연결, 빈 곳에 놓아 이어서 만들기, 체크리스트 노드와 할 일 역할",
};

const summary = [
  ["태그", "색 태그 · 공통 태그 · 미리보기 카드 · 태그 렌즈"],
  ["검색", "Ctrl+F · #태그 · 흐림과 빛남 · 하위 캔버스로 이동"],
  ["연결", "여러 노드 한꺼번에 · 빈 곳에 놓아 이어서 만들기"],
  ["할 일", "역할 · 체크리스트 노드 · 진행률"],
];

const extraSections = [
  { id: "polish", title: "작은 개선" },
  { id: "changes", title: "데이터 보관 위치" },
];

export default function Week10Page() {
  return (
    <main
      id="top"
      className="min-h-screen bg-neutral-950 px-5 text-neutral-100 selection:bg-emerald-500/40 sm:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header className="py-12 sm:py-16">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <p className="font-mono tracking-widest text-emerald-300">
              NONO / WEEK 10
            </p>
            <Link
              href="/pres/week9-2"
              className="text-neutral-400 hover:text-white"
            >
              9주차 발표
            </Link>
          </div>
          <div className="mt-8 grid items-center gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:gap-12">
            <div>
              <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
                흩어진 생각에
                <br className="hidden sm:block" /> 이름을 붙이고, 이어 간다
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-neutral-300">
                노드에 태그와 역할을 붙여 찾고, 모으고, 끝낸 일을 체크한다.
                사용자 조작부터 실행되는 함수까지 순서대로 따라간다.
              </p>
            </div>
            <figure className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5 sm:p-6">
              <figcaption className="text-xs font-medium tracking-widest text-emerald-300">
                이번 주 내용
              </figcaption>
              <dl className="mt-4 space-y-3 text-sm leading-6">
                {summary.map(([group, items]) => (
                  <div
                    key={group}
                    className="grid grid-cols-[4.5rem_1fr] gap-3"
                  >
                    <dt className="font-medium text-emerald-200">{group}</dt>
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
          {[...workflows, ...extraSections].map((section, index) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="shrink-0 text-sm text-neutral-300 hover:text-emerald-200"
            >
              <span className="mr-2 font-mono text-emerald-300">
                {String(index + 1).padStart(2, "0")}
              </span>
              {section.title}
            </a>
          ))}
        </nav>

        {workflows.map((flow, index) => (
          <section
            key={flow.id}
            id={flow.id}
            aria-labelledby={`${flow.id}-title`}
            className="scroll-mt-20 border-b border-neutral-800 py-12 sm:py-16"
          >
            <p className="font-mono text-sm tracking-widest text-emerald-300">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h2
              id={`${flow.id}-title`}
              className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              {flow.title}
            </h2>
            <div className="mt-6 border-l-2 border-emerald-400 pl-5">
              <p className="text-sm text-emerald-300">사용자 조작</p>
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
                      <span className="absolute top-0 -left-3 grid h-6 w-6 place-items-center rounded-full border border-neutral-700 bg-neutral-950 font-mono text-xs text-emerald-300">
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
                  <p className="mt-1 font-mono text-xs leading-5 break-all text-emerald-300">
                    {flow.file}
                  </p>
                </figcaption>
                <pre
                  tabIndex={0}
                  aria-label={`${flow.title} 코드 발췌`}
                  className="overflow-x-auto px-5 py-4 text-sm leading-6 text-emerald-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-400"
                >
                  <code>{flow.code}</code>
                </pre>
              </figure>
            </div>
          </section>
        ))}

        <section
          id="polish"
          aria-labelledby="polish-title"
          className="scroll-mt-20 border-b border-neutral-800 py-12 sm:py-16"
        >
          <p className="font-mono text-sm tracking-widest text-emerald-300">
            {String(workflows.length + 1).padStart(2, "0")}
          </p>
          <h2
            id="polish-title"
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            작은 개선
          </h2>
          <ul className="mt-7 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {polish.map(({ title, detail }) => (
              <li key={title} className="border-l border-neutral-700 pl-5">
                <p className="font-medium">{title}</p>
                <p className="mt-1 leading-7 text-neutral-300">{detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="changes"
          aria-labelledby="changes-title"
          className="scroll-mt-20 py-12 sm:py-16"
        >
          <p className="font-mono text-sm tracking-widest text-emerald-300">
            {String(workflows.length + 2).padStart(2, "0")}
          </p>
          <h2
            id="changes-title"
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
                  <code className="text-sm text-emerald-200">{location}</code>
                  <p className="mt-1 leading-7 text-neutral-300">{detail}</p>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="flex flex-wrap justify-between gap-4 border-t border-neutral-800 py-8 text-sm text-neutral-400">
          <p>NONO / 10주차 태그 · 검색 · 체크리스트</p>
          <a href="#top" className="hover:text-white">
            맨 위로
          </a>
        </footer>
      </div>
    </main>
  );
}
