import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Nono | 7주차 노드 편집과 실행 흐름",
  description:
    "노드 크기 조절, 다중 선택과 이동, 실행 취소가 이벤트와 상태 변경으로 이어지는 과정",
};

const workspaceFile = "src/features/workspace/workspace.tsx";
const nodeFile = "src/features/workspace/text-node-view.tsx";
const historyFile = "src/features/workspace/workspace-history.ts";

type Step = {
  event: string;
  fn: string;
  file: string;
  detail: string;
};

type Snippet = {
  title: string;
  file: string;
  code: string;
};

type Workflow = {
  id: string;
  title: string;
  action: string;
  result: string;
  steps: Step[];
  snippets: Snippet[];
};

const workflows: Workflow[] = [
  {
    id: "resize",
    title: "노드 크기 조절",
    action: "노드 오른쪽 아래 손잡이를 누르고 드래그",
    result: "노드의 위치는 유지하고 width와 height를 변경한다.",
    steps: [
      {
        event: "손잡이 누름 · pointerdown",
        fn: "onResizeStart(event, node)",
        file: nodeFile,
        detail:
          "TextNodeView의 버튼이 부모에게 이벤트와 노드 데이터를 전달한다. 실제 문서 변경은 Workspace에서 처리한다.",
      },
      {
        event: "드래그 시작",
        fn: "startNodeResize()",
        file: workspaceFile,
        detail:
          "gestureRef에 노드 ID, 시작 너비·높이, 마우스 위치, 배율을 기록한다. 포인터를 캡처하고 begin으로 편집 이력을 시작한다.",
      },
      {
        event: "마우스 이동 · pointermove",
        fn: 'moveGesture() · kind === "resize"',
        file: workspaceFile,
        detail:
          "화면 이동량을 zoom으로 나누어 캔버스 이동량으로 바꾼다. 시작 크기에 더하고, 최소 크기와 캔버스 경계를 적용한다.",
      },
      {
        event: "상태 변경과 화면 갱신",
        fn: 'setWorkspace() / reducer의 "change"',
        file: `${workspaceFile} / ${historyFile}`,
        detail:
          "대상 노드의 width·height를 바꾼 새 문서를 history.present에 반영한다. React가 TextNodeView에 새 node를 전달하고 style.width·height를 갱신한다.",
      },
      {
        event: "마우스 놓음 · pointerup",
        fn: "endGesture() / clearGesture()",
        file: workspaceFile,
        detail:
          "포인터 캡처와 gestureRef를 해제한다. commit으로 시작 문서와 최종 문서를 비교하고, 달라졌을 때만 이력 한 단계를 추가한다.",
      },
    ],
    snippets: [
      {
        title: "자식의 버튼을 부모 함수에 연결",
        file: `${nodeFile} / ${workspaceFile}`,
        code: `// TextNodeView의 손잡이
onPointerDown={(event) => onResizeStart(event, node)}

// Workspace에서 전달하는 함수
<TextNodeView onResizeStart={startNodeResize} />`,
      },
      {
        title: "시작 크기와 드래그 이동량으로 계산",
        file: `${workspaceFile} / moveGesture()`,
        code: `const nextWidth =
  gesture.startWidth + deltaX / gesture.zoom;
const nextHeight =
  gesture.startHeight + deltaY / gesture.zoom;

const maxWidth = current.canvas.width - node.position.x;
const maxHeight = current.canvas.height - node.position.y;
const minWidth = Math.min(200, maxWidth);
const minHeight = Math.min(140, maxHeight);

const width = Math.max(minWidth, Math.min(nextWidth, maxWidth));
const height = Math.max(minHeight, Math.min(nextHeight, maxHeight));`,
      },
    ],
  },
  {
    id: "selection",
    title: "다중 선택과 박스 선택",
    action: "Shift 클릭으로 선택 추가·해제 / 빈 공간을 드래그해 박스 선택",
    result:
      "선택한 노드 ID를 배열로 관리한다. 선택은 문서 데이터와 별도로 유지한다.",
    steps: [
      {
        event: "Shift 클릭",
        fn: "TextNodeView.onPointerDown / selectNode()",
        file: `${nodeFile} / ${workspaceFile}`,
        detail:
          "event.shiftKey를 additive로 전달한다. 이미 선택한 ID면 제거하고, 없으면 추가한다. 일반 클릭은 해당 노드 하나로 선택을 바꾼다.",
      },
      {
        event: "빈 공간에서 박스 선택 시작",
        fn: "startMarquee()",
        file: workspaceFile,
        detail:
          "노드 바깥의 왼쪽 클릭만 받는다. 마우스 위치를 캔버스 좌표로 바꾸고, 기존 선택과 Shift 여부를 gestureRef에 기록한다.",
      },
      {
        event: "선택 사각형 계산",
        fn: 'moveGesture() · kind === "marquee"',
        file: workspaceFile,
        detail:
          "화면에서 3px 이상 움직이면 선택 사각형을 표시한다. Math.min과 Math.abs로 방향을 정규화하므로 반대 방향으로 드래그해도 계산이 같다.",
      },
      {
        event: "사각형과 노드의 겹침 검사",
        fn: "nodes.filter() / setSelectedNodeIds()",
        file: workspaceFile,
        detail:
          "사각형과 일부라도 겹치는 노드를 고른다. Shift 드래그라면 시작 시 선택과 합치고, Set으로 중복 ID를 제거한다.",
      },
      {
        event: "선택 표시",
        fn: "selectedNodeIds.includes(node.id)",
        file: `${workspaceFile} / ${nodeFile}`,
        detail:
          "selected prop이 true인 노드는 파란 테두리를 표시한다. 마우스를 놓으면 사각형만 사라지고 선택 목록은 유지한다.",
      },
    ],
    snippets: [
      {
        title: "ID 하나에서 ID 배열로 변경",
        file: `${workspaceFile} / selectNode()`,
        code: `const [selectedNodeIds, setSelectedNodeIds] =
  useState<string[]>([]);

setSelectedNodeIds((current) => {
  if (!additive) {
    return current.length === 1 && current[0] === nodeId
      ? current
      : [nodeId];
  }

  return current.includes(nodeId)
    ? current.filter((id) => id !== nodeId)
    : [...current, nodeId];
});`,
      },
      {
        title: "노드를 완전히 감싸지 않아도 선택",
        file: `${workspaceFile} / moveGesture()`,
        code: `const hits = workspace.nodes.filter(
  (node) =>
    node.position.x < rect.x + rect.width &&
    node.position.x + node.width > rect.x &&
    node.position.y < rect.y + rect.height &&
    node.position.y + node.height > rect.y,
);

// 선택 상태를 노드 화면에 전달
selected={selectedNodeIds.includes(node.id)}`,
      },
    ],
  },
  {
    id: "move-delete",
    title: "함께 이동과 일괄 삭제",
    action: "여러 노드를 선택한 뒤 ⠿ 드래그 / 선택 삭제 버튼 또는 Delete",
    result:
      "선택한 노드만 함께 이동하거나 삭제한다. 경계에 닿아도 노드 사이 간격을 유지한다.",
    steps: [
      {
        event: "이동 손잡이 누름",
        fn: "startNodeDrag()",
        file: workspaceFile,
        detail:
          "선택된 노드를 잡으면 전체 선택을 이동 대상으로 삼는다. 선택하지 않은 노드를 잡으면 그 노드 하나로 바꾼다. Shift 클릭은 선택만 바꾸고 드래그를 시작하지 않는다.",
      },
      {
        event: "시작 위치와 전체 경계 기록",
        fn: "gestureRef.startPositions / bounds",
        file: workspaceFile,
        detail:
          "Map에 각 노드의 시작 좌표를 저장한다. 전체 선택을 감싸는 left·top·right·bottom으로 이동 가능한 범위를 계산한다.",
      },
      {
        event: "동일한 이동량 적용",
        fn: "moveGesture() / setWorkspace()",
        file: workspaceFile,
        detail:
          "전체 경계를 기준으로 moveX·moveY를 한 번 제한한다. 모든 대상의 시작 좌표에 같은 값을 더하므로 가장자리에서도 노드 사이 간격이 바뀌지 않는다.",
      },
      {
        event: "이동 종료",
        fn: 'clearGesture() / dispatchHistory({ type: "commit" })',
        file: workspaceFile,
        detail:
          "여러 노드의 변경을 하나의 작업으로 기록한다. 실행 취소 한 번으로 전체 선택의 이동 전 상태를 복원한다.",
      },
    ],
    snippets: [
      {
        title: "각 노드를 따로 제한하지 않고 전체 이동량 제한",
        file: `${workspaceFile} / moveGesture()`,
        code: `const moveX = Math.max(
  -gesture.bounds.left,
  Math.min(
    deltaX / gesture.zoom,
    current.canvas.width - gesture.bounds.right,
  ),
);

const startPosition = gesture.startPositions.get(node.id);
const x = startPosition.x + moveX;
const y = startPosition.y + moveY;
return { ...node, position: { x, y } };`,
      },
      {
        title: "선택 삭제는 같은 ID 목록을 사용",
        file: `${workspaceFile} / deleteSelectedNodes()`,
        code: `setWorkspace((current) => ({
  ...current,
  nodes: current.nodes.filter(
    (node) => !selectedNodeIds.includes(node.id),
  ),
}));

setSelectedNodeIds([]);`,
      },
    ],
  },
  {
    id: "history",
    title: "실행 취소와 다시 실행",
    action: "상단 버튼 또는 Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y",
    result:
      "문서 스냅샷을 이동시켜 생성·삭제·이동·크기 조절·텍스트 편집을 복원한다.",
    steps: [
      {
        event: "명령 입력",
        fn: "handleWorkspaceKeyDown() / undo() / redo()",
        file: workspaceFile,
        detail:
          "버튼은 undo·redo를 직접 호출한다. 단축키는 입력칸이나 IME 조합 중인지 먼저 확인하고 명령을 전달한다. 드래그 중에는 실행을 막는다.",
      },
      {
        event: "이력 상태 변경",
        fn: "dispatchHistory() / workspaceHistoryReducer()",
        file: `${workspaceFile} / ${historyFile}`,
        detail:
          "undo는 past의 마지막 문서를 present로 옮기고 현재 문서를 future에 넣는다. redo는 future의 첫 문서를 다시 present로 옮긴다.",
      },
      {
        event: "문서와 화면 복원",
        fn: "workspace = history.present / TextNodeView",
        file: workspaceFile,
        detail:
          "화면이 읽는 문서가 바뀌므로 노드의 존재 여부, 위치, 크기, 내용이 함께 복원된다. 이전 선택은 해제하고 카메라 위치는 유지한다.",
      },
      {
        event: "저장 상태 판단",
        fn: "workspace !== savedDocument",
        file: workspaceFile,
        detail:
          "마지막 저장 스냅샷으로 돌아오면 미저장 표시를 해제한다. 실행 취소는 서버 요청을 보내지 않으며 DB에 반영하려면 저장 버튼을 눌러야 한다.",
      },
    ],
    snippets: [
      {
        title: "화면이 읽는 문서를 이력의 present로 연결",
        file: workspaceFile,
        code: `const [history, dispatchHistory] = useReducer(
  workspaceHistoryReducer,
  initialDocument,
  (document) =>
    createWorkspaceHistory(expandLegacyCanvas(document)),
);
const workspace = history.present;

// 기존 편집 함수는 이 통로로 문서를 변경한다.
dispatchHistory({ type: "change", update });`,
      },
      {
        title: "실행 취소 시 스냅샷 이동",
        file: `${historyFile} / workspaceHistoryReducer()`,
        code: `const committed = commitTransaction(state);
const previous = committed.past.at(-1);
if (!previous) return committed;

return {
  past: committed.past.slice(0, -1),
  present: previous,
  future: [committed.present, ...committed.future]
    .slice(0, HISTORY_LIMIT),
  transactionStart: null,
};`,
      },
    ],
  },
];

function CodeBlock({ title, file, code }: Snippet) {
  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
      <figcaption className="border-b border-neutral-800 px-5 py-4">
        <h4 className="text-base font-medium text-neutral-100">{title}</h4>
        <p className="mt-2 font-mono text-xs leading-5 break-all text-violet-300">
          {file}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          핵심 발췌 · 주변 분기 생략
        </p>
      </figcaption>
      <pre
        tabIndex={0}
        aria-label={title}
        className="overflow-x-auto p-5 text-sm leading-7 text-violet-100 focus-visible:outline-2 focus-visible:outline-violet-400"
      >
        <code>{code}</code>
      </pre>
    </figure>
  );
}

export default function Week7Page() {
  return (
    <main
      id="top"
      className="min-h-screen bg-neutral-950 px-5 text-neutral-100 selection:bg-violet-500/40 sm:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header className="py-14 sm:py-20">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <p className="font-mono tracking-widest text-violet-300">
              NONO / WEEK 07
            </p>
            <Link
              href="/pres/week6"
              className="text-neutral-400 hover:text-white"
            >
              5·6주차 발표
            </Link>
          </div>
          <h1 className="mt-6 text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
            노드 편집과 실행 흐름
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-neutral-300">
            크기 조절, 여러 노드 선택과 이동, 실행 취소·다시 실행
          </p>
        </header>

        <nav
          aria-label="발표 목차"
          className="sticky top-0 z-30 -mx-5 flex gap-6 overflow-x-auto border-y border-neutral-800 bg-neutral-950/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8"
        >
          <a
            href="#structure"
            className="shrink-0 text-sm text-neutral-300 hover:text-violet-200"
          >
            공통 구조
          </a>
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
        </nav>

        <section
          id="structure"
          aria-labelledby="structure-title"
          className="scroll-mt-24 border-b border-neutral-800 py-14 sm:py-16"
        >
          <p className="font-mono text-sm tracking-widest text-violet-300">
            STRUCTURE
          </p>
          <h2 id="structure-title" className="mt-3 text-3xl font-semibold">
            입력을 문서 변경에 연결하는 구조
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-4">
            {[
              [
                "01",
                "이벤트 수신",
                "TextNodeView",
                "버튼·입력칸의 이벤트와 노드 데이터를 부모에게 전달",
              ],
              [
                "02",
                "동작 구분",
                "Workspace / gestureRef",
                "선택, 이동, 크기 조절을 구분하고 시작 정보 기록",
              ],
              [
                "03",
                "문서 변경",
                "workspaceHistoryReducer",
                "편집 결과를 present에 반영하고 이력 관리",
              ],
              [
                "04",
                "화면 반영",
                "history.present / node props",
                "변경한 문서로 노드의 위치·크기·내용을 다시 렌더링",
              ],
            ].map(([number, title, file, detail]) => (
              <li
                key={number}
                className="min-w-0 border-t border-neutral-700 pt-4"
              >
                <p className="font-mono text-sm text-violet-300">{number}</p>
                <h3 className="mt-2 text-lg font-medium">{title}</h3>
                <p className="mt-3 font-mono text-xs leading-5 break-words text-violet-200">
                  {file}
                </p>
                <p className="mt-2 text-sm leading-7 text-neutral-400">
                  {detail}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-8 grid gap-6 border-t border-neutral-800 pt-6 md:grid-cols-2">
            <div>
              <h3 className="font-medium">문서 상태</h3>
              <p className="mt-2 font-mono text-sm text-violet-200">
                history.present
              </p>
              <p className="mt-2 text-sm leading-7 text-neutral-400">
                노드 ID, 위치, 크기, 제목·본문을 보관한다. 저장 버튼이 이 문서를
                서버에 보낸다.
              </p>
            </div>
            <div>
              <h3 className="font-medium">조작 상태</h3>
              <p className="mt-2 font-mono text-sm text-violet-200">
                gestureRef / selectedNodeIds / selectionRect
              </p>
              <p className="mt-2 text-sm leading-7 text-neutral-400">
                드래그 정보, 선택 ID, 선택 사각형을 관리한다. 선택과 카메라
                이동은 문서 이력에 넣지 않는다.
              </p>
            </div>
          </div>
        </section>

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
                  <CodeBlock key={snippet.title} {...snippet} />
                ))}
              </div>
            </div>

            {flow.id === "resize" && (
              <p className="mt-8 border-t border-neutral-800 pt-5 text-base leading-7 text-neutral-300">
                배율이 50%일 때 마우스를 화면에서 50px 움직이면 캔버스 크기는
                100만큼 바뀐다. 최소 크기는 캔버스 좌표 기준 200 × 140이며, 남은
                캔버스 공간이 더 작으면 경계를 우선한다.
              </p>
            )}

            {flow.id === "selection" && (
              <div className="mt-8 overflow-x-auto rounded-xl border border-neutral-800">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <caption className="px-5 py-4 text-left text-base text-neutral-200">
                    클릭에 따른 selectedNodeIds 변화
                  </caption>
                  <thead className="border-y border-neutral-800 bg-neutral-900 text-neutral-400">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-medium">
                        조작
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium">
                        선택 상태
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["A 일반 클릭", "[A]"],
                      ["B Shift 클릭", "[A, B]"],
                      ["A 다시 Shift 클릭", "[B]"],
                      ["빈 공간 일반 클릭", "[]"],
                    ].map(([action, selection]) => (
                      <tr key={action} className="border-t border-neutral-800">
                        <td className="px-5 py-3">{action}</td>
                        <td className="px-5 py-3 font-mono text-violet-200">
                          {selection}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {flow.id === "move-delete" && (
              <div className="mt-8 border-t border-neutral-800 pt-6">
                <h3 className="text-lg font-medium">삭제 버튼을 누른 경우</h3>
                <p className="mt-3 font-mono text-sm leading-7 text-violet-200">
                  onClick / handleWorkspaceKeyDown() → deleteSelectedNodes() →
                  setWorkspace() → reducer의 change
                </p>
                <p className="mt-3 leading-7 text-neutral-300">
                  filter로 선택 ID를 제외한 새 배열을 만든다. 삭제 전 문서를
                  past에 보관하므로 실행 취소하면 ID와 내용, 위치까지
                  되돌아온다. 드래그 중 삭제는 차단한다.
                </p>
              </div>
            )}

            {flow.id === "history" && (
              <div className="mt-10 space-y-10">
                <div className="overflow-x-auto rounded-xl border border-neutral-800">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <caption className="px-5 py-4 text-left">
                      <span className="text-base text-neutral-100">
                        스냅샷 이동 예시
                      </span>
                      <span className="mt-2 block text-neutral-400">
                        S0는 이동 전, S1은 이동 후 문서
                      </span>
                    </caption>
                    <thead className="border-y border-neutral-800 bg-neutral-900 text-neutral-400">
                      <tr>
                        {[
                          "동작",
                          "past · 이전 문서",
                          "present · 현재 문서",
                          "future · 다시 실행",
                        ].map((label) => (
                          <th
                            key={label}
                            scope="col"
                            className="px-5 py-3 font-medium"
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["이동 완료", "[S0]", "S1", "[]"],
                        ["실행 취소", "[]", "S0", "[S1]"],
                        ["다시 실행", "[S0]", "S1", "[]"],
                      ].map(([action, ...cells]) => (
                        <tr
                          key={action}
                          className="border-t border-neutral-800"
                        >
                          <th scope="row" className="px-5 py-4 font-medium">
                            {action}
                          </th>
                          {cells.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className="px-5 py-4 font-mono text-violet-200"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid items-start gap-10 lg:grid-cols-2">
                  <div>
                    <h3 className="text-2xl font-semibold">
                      드래그 한 번을 이력 하나로 기록
                    </h3>
                    <dl className="mt-5 divide-y divide-neutral-800">
                      {[
                        ["begin", "시작 문서를 transactionStart에 보관한다."],
                        [
                          "change",
                          "마우스 이동마다 present만 갱신한다. past에는 아직 추가하지 않는다.",
                        ],
                        [
                          "commit",
                          "마우스를 놓으면 시작 문서를 past에 한 번 추가한다. 제자리로 돌아왔으면 이력을 추가하지 않는다.",
                        ],
                        [
                          "cancel",
                          "Escape를 누르면 시작 문서로 복원하고 진행 중인 작업을 버린다.",
                        ],
                      ].map(([term, detail]) => (
                        <div key={term} className="py-4">
                          <dt className="font-mono text-sm text-violet-300">
                            {term}
                          </dt>
                          <dd className="mt-2 leading-7 text-neutral-300">
                            {detail}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <CodeBlock
                    title="실제로 이력 한 단계를 확정하는 코드"
                    file={`${historyFile} / commitTransaction()`}
                    code={`return {
  past: [...state.past, start].slice(-HISTORY_LIMIT),
  present: state.present,
  future: [],
  transactionStart: null,
};`}
                  />
                </div>
                <div className="grid gap-8 border-t border-neutral-800 pt-6 md:grid-cols-2">
                  <div>
                    <h3 className="text-xl font-medium">
                      텍스트 편집과 단축키
                    </h3>
                    <p className="mt-3 font-mono text-sm leading-7 text-violet-200">
                      onFocus / beginTextEdit() · onChange / updateTextNode() ·
                      onBlur / endTextEdit()
                    </p>
                    <p className="mt-3 leading-7 text-neutral-300">
                      입력칸에 들어갔다 나오는 편집을 하나로 묶는다. 입력칸 안의
                      Ctrl+Z는 브라우저 기본 기능을 유지하고, IME 조합 중
                      단축키도 가로채지 않는다.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-medium">이력 보관 범위</h3>
                    <p className="mt-3 leading-7 text-neutral-300">
                      이력은 현재 화면의 메모리에 최근 100단계만 보관한다. 실행
                      취소 후 새로 편집하면 이전의 다시 실행 목록을 지운다.
                      새로고침하면 이력은 사라진다.
                    </p>
                    <p className="mt-3 leading-7 text-neutral-400">
                      선택과 카메라 이동은 제외한다. 서버 저장은 기존 수동 저장
                      버튼으로 처리한다.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        ))}

        <section aria-labelledby="next-title" className="py-14 sm:py-20">
          <p className="font-mono text-sm tracking-widest text-violet-300">
            NEXT / WEEK 08
          </p>
          <h2 id="next-title" className="mt-3 text-3xl font-semibold">
            노드 연결선
          </h2>
          <ul className="mt-6 list-disc space-y-3 pl-5 text-lg leading-8 text-neutral-300">
            <li>노드 연결점과 드래그로 연결선 생성</li>
            <li>노드 이동·크기 변경에 맞춰 연결선 위치 갱신</li>
            <li>연결점 스냅과 연결 관계의 저장·복원</li>
          </ul>
        </section>
        <footer className="flex flex-wrap justify-between gap-4 border-t border-neutral-800 py-8 text-sm text-neutral-500">
          <p>NONO / 7주차 노드 편집</p>
          <a href="#top" className="hover:text-white">
            맨 위로
          </a>
        </footer>
      </div>
    </main>
  );
}
