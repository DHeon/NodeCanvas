import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import ActionSequences from "./action-sequences";

export const metadata: Metadata = {
  title: "Nono | 4주차 개발 발표",
  description: "실제 프로젝트 작업 공간 구현과 이벤트·상태·렌더링 흐름",
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
  ["sequence", "동작별 시퀀스"],
  ["coordinates", "좌표 계산"],
  ["changes", "데이터 변경"],
  ["next", "한계와 다음 단계"],
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

const dragCode = [
  "// workspace.tsx · moveGesture",
  "const deltaX = event.clientX - gesture.startPointer.x;",
  "const deltaY = event.clientY - gesture.startPointer.y;",
  "",
  "// 화면 이동: 화면 픽셀만큼 카메라를 이동",
  "x: gesture.startCamera.x + deltaX,",
  "y: gesture.startCamera.y + deltaY,",
  "",
  "// 노드 이동: 화면 이동량을 캔버스 단위로 변환",
  "const nextX = gesture.startPosition.x + deltaX / gesture.zoom;",
  "const nextY = gesture.startPosition.y + deltaY / gesture.zoom;",
].join("\n");

const updateCode = [
  "function updateTextNode(nodeId: string, patch: TextNodeContentPatch) {",
  "  setWorkspace((current) => ({",
  "    ...current,",
  "    nodes: current.nodes.map((node) =>",
  "      node.id === nodeId ? { ...node, ...patch } : node,",
  "    ),",
  "  }));",
  "}",
].join("\n");

const zoomCode = [
  "// handleWheel · 마우스 아래에 있는 캔버스 좌표",
  "const canvasX = (pointerX - current.x) / current.zoom;",
  "const canvasY = (pointerY - current.y) / current.zoom;",
  "",
  "// 새 배율에서도 그 좌표가 같은 화면 위치에 오도록 보정",
  "return {",
  "  x: pointerX - canvasX * zoom,",
  "  y: pointerY - canvasY * zoom,",
  "  zoom,",
  "};",
].join("\n");

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

function SpeakerNote({ children }: { children: ReactNode }) {
  return (
    <details className="mt-6 rounded-xl border border-neutral-800 px-5 py-4">
      <summary className="cursor-pointer text-sm text-violet-300 focus-visible:outline-2 focus-visible:outline-violet-400">
        발표 메모 펼치기
      </summary>
      <div className="mt-3 text-sm leading-7 text-neutral-300">{children}</div>
    </details>
  );
}

// 동작별 시퀀스는 ActionSequences에서 공통 흐름으로 표시한다.

export default function Week4Page() {
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
            <Link
              href="/pres/week3"
              className="text-neutral-400 hover:text-white"
            >
              ← 3주차 발표
            </Link>
          </div>
          <h1 className="mt-10 text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
            작업 공간 구현
            <br />
            <span className="text-neutral-400">입력에서 화면 반영까지</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-300">
            캔버스와 텍스트 노드를 실제 프로젝트 페이지에 연결하고,
            <br className="hidden sm:block" />
            사용자 조작이 함수·상태·렌더링으로 이어지는 과정을 구현했습니다.
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
            데모에서 실제 프로젝트 작업 공간으로
          </Heading>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <article className={cardClass}>
              <p className="text-sm text-neutral-400">3주차</p>
              <h3 className="mt-3 text-xl font-medium">
                별도의 발표용 프로토타입
              </h3>
              <p className="mt-3 leading-7 text-neutral-300">
                pres/demo에서 캔버스의 사용 방식을 먼저 시연했습니다.
              </p>
            </article>
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
          <SpeakerNote>
            인증 기능 확장보다 서비스의 핵심인 작업 공간을 우선했습니다. 이번
            주의 초점은 기능 수를 늘리는 것보다, 조작이 어떤 코드를 거쳐
            데이터와 화면을 바꾸는지 설명할 수 있게 만드는 것입니다.
          </SpeakerNote>
        </section>

        <section
          id="demo"
          aria-labelledby="demo-title"
          className={sectionClass}
        >
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <Heading id="demo-title" number="02" eyebrow="LIVE DEMO">
                직접 조작하며 확인하기
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
          <ol className="mt-7 grid gap-3 text-sm leading-6 text-neutral-300 sm:grid-cols-3">
            <li className={cardClass}>
              <span className="text-violet-300">01</span>
              <p className="mt-2">
                텍스트 노드 두 개 생성
                <br />
                제목과 본문 입력
              </p>
            </li>
            <li className={cardClass}>
              <span className="text-violet-300">02</span>
              <p className="mt-2">
                ⠿를 잡고 노드 이동
                <br />
                확대 후 같은 동작 반복
              </p>
            </li>
            <li className={cardClass}>
              <span className="text-violet-300">03</span>
              <p className="mt-2">
                휠 버튼으로 화면 이동
                <br />
                화면 맞춤 → 선택 삭제
              </p>
            </li>
          </ol>
          <div className="mt-6 overflow-hidden rounded-xl border border-neutral-700 bg-white">
            <iframe
              src={demoUrl}
              title="4주차 실제 프로젝트 작업 공간 시연"
              loading="lazy"
              className="h-[560px] w-full border-0 sm:h-[680px]"
            />
          </div>
          <p className="mt-4 text-sm leading-7 text-amber-200/90">
            현재 내용은 메모리에만 유지됩니다. 새로고침하면 초기화되며, 위
            시연과 새 탭은 서로 별도의 상태입니다.
          </p>
          <SpeakerNote>
            먼저 조작 결과를 보여준 뒤 다음 섹션에서 코드를 설명합니다. 본문을
            길게 입력하면 본문 영역에서는 스크롤만 되고 캔버스 확대는 일어나지
            않는 것도 확인할 수 있습니다.
          </SpeakerNote>
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
          <p className="mt-5 text-sm leading-7 text-neutral-400">
            파일 경로는 src/ 기준입니다. page.tsx는 서버 컴포넌트, Workspace는
            사용자 입력을 처리하는 클라이언트 컴포넌트입니다.
          </p>
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
          <SpeakerNote>
            노드 데이터의 원본은 Workspace 한 곳에 있습니다. TextNodeView는 자체
            상태를 따로 만들지 않고 props로 받은 값을 보여주며, 변경 요청을
            부모에게 전달합니다. 현재 projectId는 전달·표시만 하며 DB 조회나
            소유권 검사는 아직 하지 않습니다.
          </SpeakerNote>
        </section>

        <section
          id="sequence"
          aria-labelledby="sequence-title"
          className={sectionClass}
        >
          <Heading id="sequence-title" number="04" eyebrow="SEQUENCE">
            네 가지 흐름으로 보는 작업 공간
          </Heading>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-neutral-300">
            문서 편집, 드래그, 화면 보기, 진입·종료. 공통 처리 과정은 하나로
            묶고 동작별 차이는 분기로 설명합니다.
          </p>
          <ActionSequences />
          <SpeakerNote>
            첫 번째는 문서와 선택 상태를 바꾸는 흐름, 두 번째는 시작·이동·종료로
            이어지는 드래그, 세 번째는 카메라와 스크롤 처리, 마지막은 페이지의
            초기화와 정리입니다. UI 이벤트 전달과 React 내부 처리는 핵심 코드
            중심으로 간소화했으며, 아직 서버 문서 저장·조회는 없습니다.
          </SpeakerNote>
        </section>

        <section
          id="coordinates"
          aria-labelledby="coordinates-title"
          className={sectionClass}
        >
          <Heading id="coordinates-title" number="05" eyebrow="COORDINATES">
            화면 좌표와 캔버스 좌표는 다르다
          </Heading>
          <div className="mt-8 rounded-2xl border border-violet-400/30 bg-violet-400/5 p-6">
            <p className="text-sm text-violet-300">뷰포트 기준 · x축 예시</p>
            <p className="mt-4 font-mono text-lg leading-8 sm:text-2xl">
              화면 위치 = camera.x + 노드 좌표 × zoom
            </p>
            <p className="mt-3 text-sm leading-7 text-neutral-300">
              화면을 이동하거나 확대해도 노드의 문서 좌표는 그대로입니다. 부모
              캔버스의 CSS transform만 변경합니다.
            </p>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <CodeBlock
              label="workspace.tsx · moveGesture 핵심 발췌"
              code={dragCode}
            />
            <div className={cardClass}>
              <h3 className="text-xl font-medium">왜 배율로 나눌까?</h3>
              <p className="mt-4 leading-7 text-neutral-300">
                200% 화면에서 마우스를 100px 움직였다면, 캔버스 안에서는 50만큼
                이동해야 합니다.
              </p>
              <p className="mt-5 rounded-lg bg-neutral-950 p-4 font-mono text-lg text-violet-200">
                100 ÷ 2 = 50
              </p>
              <p className="mt-4 text-sm leading-7 text-neutral-400">
                나누지 않으면 확대된 화면에서 노드가 마우스보다 빠르게
                움직입니다. 카메라 이동량은 화면 픽셀 기준이므로 나누지
                않습니다.
              </p>
              <p className="mt-5 border-t border-neutral-800 pt-5 text-sm leading-7 text-neutral-300">
                경계 제한: 노드의 x는 0부터 ‘캔버스 너비 − 노드 너비’ 사이로
                제한합니다.
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div>
              <h3 className="text-xl font-medium">
                확대할 때도 포인터 아래 지점을 유지
              </h3>
              <p className="mt-4 leading-7 text-neutral-300">
                handleWheel은 기존 마우스 아래의 캔버스 좌표를 구하고, 새
                배율에서도 같은 화면 위치에 오도록 camera.x와 camera.y를
                보정합니다.
              </p>
              <p className="mt-4 text-sm leading-7 text-neutral-400">
                수동 확대·축소: 10~200%. 화면 맞춤은 fitCanvas가 뷰포트 크기를
                측정해 전체가 들어오는 배율과 중앙 위치를 계산합니다.
              </p>
            </div>
            <CodeBlock
              label="workspace.tsx · handleWheel 핵심 발췌"
              code={zoomCode}
            />
          </div>
          <SpeakerNote>
            좌표 계산의 기준은 한 가지입니다. 화면 좌표는 카메라 이동량에 캔버스
            좌표와 배율을 곱한 값을 더한 것입니다. 반대로 마우스 위치를 문서
            좌표로 바꿀 때는 이동량을 빼고 배율로 나눕니다.
          </SpeakerNote>
        </section>

        <section
          id="changes"
          aria-labelledby="changes-title"
          className={sectionClass}
        >
          <Heading id="changes-title" number="06" eyebrow="DATA FLOW">
            추가·입력·삭제도 데이터 변경으로 처리
          </Heading>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              [
                "생성",
                "addTextNode",
                "nodes: [...current.nodes, node]",
                "새 ID와 위치를 가진 노드를 배열에 추가하고 선택합니다.",
              ],
              [
                "편집",
                "updateTextNode",
                "nodes: current.nodes.map(...)",
                "ID가 일치하는 노드만 교체합니다. 나머지 노드는 유지합니다.",
              ],
              [
                "삭제",
                "deleteSelectedNode",
                "nodes: current.nodes.filter(...)",
                "선택된 ID를 제외한 배열을 만들고 선택 상태를 비웁니다.",
              ],
            ].map(([label, fn, code, detail]) => (
              <article key={label} className={cardClass}>
                <p className="text-sm text-violet-300">{label}</p>
                <h3 className="mt-3 font-mono text-sm">{fn}</h3>
                <p className="mt-4 font-mono text-xs leading-6 break-words text-neutral-400">
                  {code}
                </p>
                <p className="mt-3 text-sm leading-7 text-neutral-300">
                  {detail}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <CodeBlock
              label="text-node-view.tsx · 제목 입력 이벤트"
              code={[
                "value={node.title}",
                "onChange={(event) => {",
                "  onChange(node.id, { title: event.target.value });",
                "}}",
              ].join("\n")}
            />
            <CodeBlock
              label="workspace.tsx · 실제 데이터 수정 함수"
              code={updateCode}
            />
          </div>
          <p className="mt-5 text-sm leading-7 text-neutral-300">
            입력 이벤트 → 부모의 updateTextNode 호출 → 새 workspace 상태 →
            node.title을 props로 전달 → input의 value에 반영.
          </p>
          <SpeakerNote>
            기존 데이터를 직접 덮어쓰지 않고 새 객체와 배열을 반환합니다.
            TextNodeContentPatch는 제목과 본문 중 바꾸려는 값만 받는 타입이며,
            위치나 ID는 이 수정 경로에 포함하지 않습니다.
          </SpeakerNote>
        </section>

        <section
          id="next"
          aria-labelledby="next-title"
          className={sectionClass}
        >
          <Heading id="next-title" number="07" eyebrow="NEXT STEP">
            다음은 메모리의 문서를 서버에 저장
          </Heading>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <article className={cardClass}>
              <h3 className="text-xl font-medium">현재 구현 범위</h3>
              <ul className="mt-5 list-disc space-y-3 pl-5 text-sm leading-7 text-neutral-300">
                <li>HTML 요소와 CSS transform 기반 캔버스</li>
                <li>텍스트 노드의 데이터와 조작 처리</li>
                <li>입력 영역의 스크롤과 캔버스 줌 분리</li>
                <li>포인터 종료·취소·창 전환 시 드래그 정리</li>
              </ul>
              <p className="mt-5 border-t border-neutral-800 pt-5 text-sm leading-7 text-amber-200/90">
                아직 문서 저장·불러오기, 프로젝트 접근 권한 검사, 실행 취소는
                없습니다. 새로고침하면 빈 작업 공간으로 돌아갑니다.
              </p>
            </article>
            <article className="rounded-2xl border border-violet-400/40 bg-violet-400/5 p-6">
              <p className="text-sm text-violet-300">5주차 계획</p>
              <h3 className="mt-3 text-xl font-medium">
                문서 저장·불러오기 API와 DB 연결
              </h3>
              <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-7 text-neutral-300">
                <li>WorkspaceDocument의 저장 형식과 프로젝트 관계 설계</li>
                <li>입력 검증과 저장·조회 처리 구현</li>
                <li>프로젝트 진입 시 문서 복원</li>
                <li>저장 → 새로고침 → 복원 시나리오 검증</li>
              </ol>
              <p className="mt-5 text-sm leading-7 text-neutral-400">
                발표 초점: 클라이언트 요청 → 서버 검증 → DB 반영 → 응답의
                시퀀스.
              </p>
            </article>
          </div>
          <details className="mt-6 rounded-xl border border-neutral-800 px-5 py-4">
            <summary className="cursor-pointer text-sm text-violet-300 focus-visible:outline-2 focus-visible:outline-violet-400">
              발표 전 조작 확인 목록
            </summary>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-neutral-300">
              <li>노드 두 개의 제목·본문이 서로 독립적으로 변경되는지 확인</li>
              <li>
                서로 다른 확대 배율에서도 드래그가 포인터를 따라오는지 확인
              </li>
              <li>노드 경계 제한, 빈 공간 선택 해제, 선택 삭제 확인</li>
              <li>긴 본문 위에서는 휠이 본문만 스크롤하는지 확인</li>
              <li>발표할 컴퓨터에서 페이지와 새 탭 시연을 미리 열어 확인</li>
            </ul>
          </details>
          <SpeakerNote>
            이번 주에는 브라우저 안에서 문서가 바뀌는 흐름을 구현했습니다. 다음
            주에는 같은 문서 데이터를 서버에 저장하고 다시 복원하는 흐름으로
            확장하겠습니다.
          </SpeakerNote>
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
