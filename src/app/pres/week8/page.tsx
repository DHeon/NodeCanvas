import type { Metadata } from "next";
import Link from "next/link";
import { workflows } from "./content";

export const metadata: Metadata = {
  title: "Nono | 8주차 연결선, Inspector, 이미지 노드",
  description:
    "연결선과 Inspector, 이미지 업로드의 사용자 조작부터 상태 변경과 서버 저장까지",
};

export default function Week8Page() {
  return (
    <main
      id="top"
      className="min-h-screen bg-neutral-950 px-5 text-neutral-100 selection:bg-violet-500/40 sm:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header className="py-14 sm:py-20">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <p className="font-mono tracking-widest text-violet-300">
              NONO / WEEK 08
            </p>
            <Link
              href="/pres/week7"
              className="text-neutral-400 hover:text-white"
            >
              7주차 발표
            </Link>
          </div>
          <h1 className="mt-6 text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
            연결선, Inspector, 이미지 노드
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-neutral-300">
            사용자 조작에서 상태 변경, 화면 갱신과 서버 저장까지
          </p>
        </header>
        <nav
          aria-label="발표 목차"
          className="sticky top-0 z-30 -mx-5 flex gap-6 overflow-x-auto border-y border-neutral-800 bg-neutral-950/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8"
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
            href="#persistence"
            className="shrink-0 text-sm text-neutral-300 hover:text-violet-200"
          >
            05 저장되는 데이터
          </a>
        </nav>
        {workflows.map((flow, index) => (
          <section
            key={flow.id}
            id={flow.id}
            aria-labelledby={`${flow.id}-title`}
            className="scroll-mt-24 border-b border-neutral-800 py-14 sm:py-20"
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
              <p className="mt-2 text-lg leading-8">{flow.action}</p>
              <p className="mt-2 leading-7 text-neutral-400">{flow.result}</p>
            </div>
            <div className="mt-10 grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <h3 className="text-sm font-medium text-neutral-400">
                  실행 순서와 상태 변화
                </h3>
                <ol className="mt-6 space-y-6">
                  {flow.steps.map((step, stepIndex) => (
                    <li
                      key={step.event}
                      className="relative border-l border-neutral-700 pl-6"
                    >
                      <span className="absolute top-0 -left-3 grid h-6 w-6 place-items-center rounded-full border border-neutral-700 bg-neutral-950 font-mono text-xs text-violet-300">
                        {stepIndex + 1}
                      </span>
                      <p className="text-sm text-violet-300">{step.event}</p>
                      <h4 className="mt-2 font-mono text-sm leading-6 break-words text-neutral-100">
                        {step.fn}
                      </h4>
                      <p className="mt-1 font-mono text-xs leading-5 break-all text-neutral-500">
                        {step.file}
                      </p>
                      <p className="mt-3 text-base leading-7 text-neutral-300">
                        {step.detail}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="min-w-0 space-y-5">
                {flow.snippets.map((snippet) => (
                  <figure
                    key={snippet.title}
                    className="min-w-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60"
                  >
                    <figcaption className="border-b border-neutral-800 px-5 py-4">
                      <h4 className="text-base font-medium text-neutral-100">
                        {snippet.title}
                      </h4>
                      <p className="mt-2 font-mono text-xs leading-5 break-all text-violet-300">
                        {snippet.file}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        핵심 발췌 · 타입과 주변 분기 일부 생략
                      </p>
                    </figcaption>
                    <pre
                      tabIndex={0}
                      aria-label={snippet.title}
                      className="overflow-x-auto p-5 text-sm leading-7 text-violet-100 focus-visible:outline-2 focus-visible:outline-violet-400"
                    >
                      <code>{snippet.code}</code>
                    </pre>
                  </figure>
                ))}
              </div>
            </div>
            <p className="mt-8 border-t border-neutral-800 pt-5 text-base leading-7 text-neutral-300">
              {flow.note}
            </p>
          </section>
        ))}
        <section
          id="persistence"
          aria-labelledby="persistence-title"
          className="scroll-mt-24 py-14 sm:py-20"
        >
          <p className="font-mono text-sm tracking-widest text-violet-300">
            05
          </p>
          <h2 id="persistence-title" className="mt-3 text-3xl font-semibold">
            저장되는 데이터
          </h2>
          <div className="mt-8 overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full min-w-[650px] text-left text-sm">
              <caption className="sr-only">
                작업 화면 상태와 DB 저장 데이터의 구분
              </caption>
              <thead className="border-b border-neutral-800 bg-neutral-900 text-neutral-400">
                <tr>
                  {["대상", "보관 위치", "내용과 저장 시점"].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-5 py-4 font-medium"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "노드와 연결 관계",
                    "project.document (JSONB)",
                    "nodes·connections·이미지 참조. 저장 버튼으로 확정한다.",
                  ],
                  [
                    "이미지 파일",
                    "image_asset (bytea)",
                    "프로젝트별 WebP 바이너리. 업로드가 끝나면 서버에 존재한다.",
                  ],
                  [
                    "Inspector 수정값",
                    "같은 document의 node",
                    "별도 설정 사본 없이 노드의 제목·좌표·크기·내용을 바꾼다.",
                  ],
                  [
                    "선택·스냅·패널 열림",
                    "React 화면 상태",
                    "DB에 저장하지 않는다. Undo 문서 스냅샷에도 포함하지 않는다.",
                  ],
                ].map(([subject, location, detail]) => (
                  <tr key={subject} className="border-t border-neutral-800">
                    <th scope="row" className="px-5 py-4 font-medium">
                      {subject}
                    </th>
                    <td className="px-5 py-4 font-mono text-violet-200">
                      {location}
                    </td>
                    <td className="px-5 py-4 leading-7 text-neutral-300">
                      {detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 leading-8 text-neutral-300">
            Project 한 개에 ImageAsset 여러 개가 속한다. 문서 저장 API는 세션의
            소유자와 이미지 소속을 확인하고 expectedVersion으로 다른 화면의
            저장과 충돌하는지 검사한다.
          </p>
        </section>
        <footer className="flex flex-wrap justify-between gap-4 border-t border-neutral-800 py-8 text-sm text-neutral-500">
          <p>NONO / 8주차 작업 공간</p>
          <a href="#top" className="hover:text-white">
            맨 위로
          </a>
        </footer>
      </div>
    </main>
  );
}
