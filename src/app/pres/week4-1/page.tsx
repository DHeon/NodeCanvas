import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import SequenceExplanations from "./sequence-explanations";

export const metadata: Metadata = {
  title: "Nono | 4주차 개발 발표",
  description: "작업 공간의 입력·함수·상태 변경·렌더링 과정",
};

// prisma/seed.ts에 정의한 테스트 프로젝트. 현재 작업 공간은 DB를 조회하지 않는다.
const demoUrl = "/projects/00000000-0000-4000-8000-000000000001";
const sectionClass = "scroll-mt-8 border-t border-neutral-800 py-14 sm:py-20";
const cardClass =
  "rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 sm:p-6";
const linkClass =
  "inline-flex items-center justify-center rounded-lg border border-neutral-600 px-4 py-2.5 text-sm font-medium hover:border-violet-300 hover:text-violet-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400";

const sections = [
  ["progress", "구현 범위"],
  ["demo", "실제 시연"],
  ["structure", "파일과 상태"],
  ["sequence", "동작별 처리 순서"],
  ["next", "다음 주 계획"],
];

const fileRoles = [
  {
    file: "features/workspace/types.ts",
    role: "데이터의 형태",
    detail:
      "Point, Camera, TextNode, WorkspaceDocument를 정의합니다. 타입 선언 자체가 데이터를 생성하거나 저장하지는 않습니다.",
  },
  {
    file: "features/workspace/text-node-view.tsx",
    role: "노드 하나의 화면",
    detail:
      "전달받은 node와 selected를 표시합니다. 선택·이동 시작·입력을 부모가 전달한 함수로 알립니다.",
  },
  {
    file: "app/(app)/projects/[projectId]/page.tsx",
    role: "프로젝트 진입점",
    detail:
      "URL의 projectId를 받아 Workspace에 전달합니다. key가 달라지면 작업 공간의 상태를 새로 시작합니다.",
  },
  {
    file: "features/workspace/workspace.tsx",
    role: "상태와 조작의 중심",
    detail:
      "노드 데이터와 카메라를 관리하고, 이벤트를 처리한 결과를 다시 화면에 전달합니다.",
  },
];

const stateRows = [
  [
    "workspace",
    "useState",
    "캔버스 크기 · 노드의 위치, 크기, 제목, 본문",
    "문서 내용",
  ],
  ["camera", "useState", "캔버스 전체의 화면 이동량 x, y와 zoom", "보는 방식"],
  ["selectedNodeId", "useState", "선택된 노드 ID 또는 null", "선택 표시"],
  ["isPanning", "useState", "화면 드래그 중인지", "커서 표시"],
  [
    "gestureRef",
    "useRef",
    "드래그 종류 · 시작 마우스 위치 · 시작 좌표",
    "조작 중 참고값",
  ],
  ["viewportRef", "useRef", "뷰포트 DOM 요소", "크기 측정 · 이벤트 연결"],
];


function Heading({
  id,
  number,
  eyebrow,
  children,
}: {
  id: string;
  number: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <>
      <p className="font-mono text-sm tracking-widest text-violet-300">
        {number} / {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-3 text-3xl leading-tight font-semibold tracking-tight sm:text-4xl"
      >
        {children}
      </h2>
    </>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
      <figcaption className="border-b border-neutral-800 px-5 py-3 font-mono text-xs leading-6 break-words text-neutral-400">
        {label}
      </figcaption>
      <pre
        tabIndex={0}
        aria-label={label}
        className="overflow-x-auto p-5 text-sm leading-7 text-violet-100 focus-visible:outline-2 focus-visible:outline-violet-400"
      >
        <code>{code}</code>
      </pre>
    </figure>
  );
}

// week4-1: 짧은 처리 흐름과 핵심 코드 중심의 발표 자료.

export default function Week4TextPage() {
  return (
    <main
      id="top"
      className="min-h-screen bg-neutral-950 px-5 text-neutral-100 selection:bg-violet-500/40 sm:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header className="py-16 sm:py-24">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <p className="font-medium text-violet-300">
              NONO / 4주차 개발 발표
            </p>
          </div>
          <h1 className="mt-10 text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
            작업 공간 구현
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-300">
            캔버스와 텍스트 노드를 실제 프로젝트 페이지에 연결하고,
            <br className="hidden sm:block" />
            사용자 조작이 함수·상태·렌더링으로 이어지는 과정을 구현
          </p>
          <div className="mt-8 flex flex-wrap gap-2 text-xs text-neutral-300">
            {[
              "Next.js · React",
              "TypeScript",
              "Pointer Events",
              "CSS transform",
            ].map((item) => (
              <span
                key={item}
                className="rounded-full border border-neutral-700 px-3 py-1.5"
              >
                {item}
              </span>
            ))}
          </div>
          <nav
            aria-label="4주차 발표 목차"
            className="mt-10 flex flex-wrap gap-x-5 gap-y-3 border-t border-neutral-800 pt-6"
          >
            {sections.map(([id, label], index) => (
              <a
                key={id}
                href={"#" + id}
                className="text-sm text-neutral-400 underline-offset-4 hover:text-violet-200 hover:underline"
              >
                <span className="mr-2 font-mono text-violet-300">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {label}
              </a>
            ))}
          </nav>
        </header>

        <section
          id="progress"
          aria-labelledby="progress-title"
          className={sectionClass}
        >
          <Heading id="progress-title" number="01" eyebrow="SCOPE">
            캔버스와 텍스트 노드 기반 작업 공간
          </Heading>
          <div className="mt-8">
            <article className="rounded-2xl border border-violet-400/40 bg-violet-400/5 p-6">
              <p className="text-sm text-violet-300">4주차</p>
              <h3 className="mt-3 text-xl font-medium">
                프로젝트 경로에 편집 공간 연결
              </h3>
              <p className="mt-3 leading-7 text-neutral-300">
                /projects/[projectId]에 작업 공간을 연결하고, 데이터 타입과 노드
                화면을 분리했습니다.
              </p>
            </article>
          </div>
          <ul className="mt-8 grid gap-3 text-sm leading-7 text-neutral-300 sm:grid-cols-2">
            {[
              "1600 × 1000 유한 캔버스와 화면 맞춤",
              "휠 버튼 드래그로 화면 이동",
              "마우스 위치 기준 휠 확대·축소",
              "텍스트 노드 생성·제목 및 본문 편집",
              "노드 선택·이동·캔버스 경계 제한",
              "선택 노드 삭제·빈 공간 클릭으로 선택 해제",
            ].map((item) => (
              <li
                key={item}
                className="rounded-lg border border-neutral-800 px-4 py-3"
              >
                <span aria-hidden="true" className="mr-3 text-violet-300">
                  •
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section
          id="demo"
          aria-labelledby="demo-title"
          className={sectionClass}
        >
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <Heading id="demo-title" number="02" eyebrow="LIVE DEMO">
                작업공간
              </Heading>
            </div>
            <Link
              href={demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              작업 공간 새 탭으로 열기 ↗
            </Link>
          </div>
          <div className="mt-6 overflow-hidden rounded-xl border border-neutral-700 bg-white">
            <iframe
              src={demoUrl}
              title="4주차 실제 프로젝트 작업 공간 시연"
              loading="lazy"
              className="h-[560px] w-full border-0 sm:h-[680px]"
            />
          </div>
        </section>

        <section
          id="structure"
          aria-labelledby="structure-title"
          className={sectionClass}
        >
          <Heading id="structure-title" number="03" eyebrow="ARCHITECTURE">
            데이터 · 화면 · 조작의 역할 분리
          </Heading>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {fileRoles.map((item) => (
              <article key={item.file} className={cardClass}>
                <p className="font-mono text-xs leading-6 break-words text-violet-300">
                  {item.file}
                </p>
                <h3 className="mt-3 text-xl font-medium">{item.role}</h3>
                <p className="mt-3 text-sm leading-7 text-neutral-300">
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <CodeBlock
              label="types.ts · 문서 내용과 화면 상태를 분리"
              code={[
                "type WorkspaceDocument = {",
                "  canvas: { width: number; height: number };",
                "  nodes: TextNode[];",
                "};",
                "",
                "type Camera = {",
                "  x: number;",
                "  y: number;",
                "  zoom: number;",
                "};",
              ].join("\n")}
            />
            <CodeBlock
              label="workspace.tsx · 부모가 데이터와 처리 함수를 전달"
              code={[
                "<TextNodeView",
                "  node={node}",
                "  selected={selectedNodeId === node.id}",
                "  onSelect={setSelectedNodeId}",
                "  onDragStart={startNodeDrag}",
                "  onChange={updateTextNode}",
                "/>",
              ].join("\n")}
            />
          </div>
          <div className="mt-8 overflow-x-auto rounded-xl border border-neutral-800">
            <table className="w-full min-w-[680px] text-left text-sm">
              <caption className="px-5 py-4 text-left text-neutral-300">
                상태가 바뀌면 화면을 갱신하고, ref에는 조작 중 참고할 정보를
                보관합니다.
              </caption>
              <thead className="border-y border-neutral-800 bg-neutral-900 text-neutral-400">
                <tr>
                  {["이름", "보관 방식", "내용", "역할"].map((name) => (
                    <th
                      key={name}
                      scope="col"
                      className="px-5 py-3 font-medium"
                    >
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stateRows.map(([name, storage, content, purpose]) => (
                  <tr key={name} className="border-t border-neutral-800">
                    <th
                      scope="row"
                      className="px-5 py-4 font-mono font-normal text-violet-200"
                    >
                      {name}
                    </th>
                    <td className="px-5 py-4 text-neutral-400">{storage}</td>
                    <td className="px-5 py-4 leading-6 text-neutral-300">
                      {content}
                    </td>
                    <td className="px-5 py-4 text-neutral-400">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section
          id="sequence"
          aria-labelledby="sequence-title"
          className={sectionClass}
        >
          <Heading id="sequence-title" number="04" eyebrow="PROCESS">
            사용자 입력이 화면에 반영되는 과정
          </Heading>
          <p className="mt-5 text-lg text-neutral-300">
            입력은 이벤트로, 변경은 상태로, 결과는 React 렌더링으로 연결합니다.
          </p>
          <SequenceExplanations />
        </section>


        <section
          id="next"
          aria-labelledby="next-title"
          className={sectionClass}
        >
          <Heading id="next-title" number="05" eyebrow="NEXT STEP">
            5주차 · 문서 저장과 불러오기
          </Heading>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              [
                "01",
                "저장 구조 설계",
                "WorkspaceDocument의 저장 형식과 프로젝트 관계",
              ],
              ["02", "저장·조회 API", "입력 검증과 DB 저장·불러오기 처리"],
              ["03", "프로젝트 문서 복원", "진입 시 저장된 노드와 캔버스 표시"],
              ["04", "저장 흐름 검증", "편집 → 저장 → 새로고침 → 복원"],
            ].map(([number, title, description]) => (
              <article key={number} className={cardClass}>
                <p className="font-mono text-sm text-violet-300">{number}</p>
                <h3 className="mt-3 text-xl font-medium">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-neutral-300">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <footer className="flex flex-wrap justify-between gap-4 border-t border-neutral-800 py-8 text-sm text-neutral-400">
          <p>NONO · 4주차 개발 기록</p>
          <a
            href="#top"
            className="underline-offset-4 hover:text-white hover:underline"
          >
            맨 위로 ↑
          </a>
        </footer>
      </div>
    </main>
  );
}
