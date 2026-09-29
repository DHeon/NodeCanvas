// 동작별 처리 과정을 발표 화면용으로 요약한다.

type FlowStep = { title: string; code: string; result: string };

function FlowRow({ steps }: { steps: FlowStep[] }) {
  return (
    <ol className="mt-6 grid gap-4 md:grid-cols-4">
      {steps.map((step, index) => (
        <li
          key={step.title}
          className="relative min-w-0 rounded-xl border border-neutral-700 bg-neutral-950 p-4"
        >
          <p className="font-mono text-xs text-violet-300">
            {String(index + 1).padStart(2, "0")}
          </p>
          <h4 className="mt-3 text-base font-medium">{step.title}</h4>
          <code className="mt-3 block text-xs leading-6 break-words text-violet-200">
            {step.code}
          </code>
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            {step.result}
          </p>
          {index < steps.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute top-1/2 -right-3 z-10 hidden -translate-y-1/2 bg-neutral-900 px-1 text-violet-300 md:block"
            >
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function Snippet({ label, lines }: { label: string; lines: string[] }) {
  return (
    <figure className="mt-6 min-w-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
      <figcaption className="border-b border-neutral-800 px-5 py-3 text-xs text-neutral-400">
        {label}
      </figcaption>
      <pre
        tabIndex={0}
        aria-label={label}
        className="overflow-x-auto p-5 text-sm leading-7 text-violet-100 focus-visible:outline-2 focus-visible:outline-violet-400"
      >
        <code>{lines.join("\n")}</code>
      </pre>
    </figure>
  );
}

const panelClass =
  "scroll-mt-8 rounded-2xl border border-neutral-800 bg-neutral-900/30 p-5 sm:p-7";

export default function SequenceExplanations() {
  return (
    <div className="mt-8 space-y-8">
      <article
        id="flow-document"
        aria-labelledby="flow-document-title"
        className={panelClass}
      >
        <p className="font-mono text-sm text-violet-300">01 / NODE DATA</p>
        <h3 id="flow-document-title" className="mt-3 text-2xl font-semibold">
          입력 → 상태 변경 → 화면 반영
        </h3>
        <FlowRow
          steps={[
            {
              title: "제목 입력",
              code: "TextNodeView · onChange",
              result: "노드 ID와 새 제목 전달",
            },
            {
              title: "수정 함수 호출",
              code: "updateTextNode(id, patch)",
              result: "수정 대상 노드 확인",
            },
            {
              title: "문서 상태 변경",
              code: "setWorkspace",
              result: "해당 노드만 새 객체로 교체",
            },
            {
              title: "화면 갱신",
              code: "node.title → input.value",
              result: "새 props로 변경 내용 표시",
            },
          ]}
        />
        <Snippet
          label="workspace.tsx · 수정 대상만 교체"
          lines={[
            "nodes: current.nodes.map((node) =>",
            "  node.id === nodeId ? { ...node, ...patch } : node,",
            ")",
          ]}
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["생성", "addTextNode", "배열 추가 · 선택 · 중앙 배치"],
            ["편집", "updateTextNode", "ID로 찾아 제목·본문 교체"],
            ["삭제", "deleteSelectedNode", "선택 ID 제외 · 선택 해제"],
            [
              "선택 / 해제",
              "setSelectedNodeId",
              "ID 또는 null · 문서 내용 유지",
            ],
          ].map(([action, handler, change]) => (
            <div key={action} className="border-l-2 border-violet-400/40 pl-4">
              <h4 className="text-sm font-medium">{action}</h4>
              <code className="mt-2 block text-xs break-words text-violet-200">
                {handler}
              </code>
              <p className="mt-2 text-xs leading-6 text-neutral-400">
                {change}
              </p>
            </div>
          ))}
        </div>
      </article>

      <article
        id="flow-drag"
        aria-labelledby="flow-drag-title"
        className={panelClass}
      >
        <p className="font-mono text-sm text-violet-300">02 / DRAG</p>
        <h3 id="flow-drag-title" className="mt-3 text-2xl font-semibold">
          시작점을 기억하고, 이동량을 반영
        </h3>
        <FlowRow
          steps={[
            {
              title: "누르기",
              code: "startNodeDrag / startPan",
              result: "노드 ⠿: 왼쪽 버튼 · 화면: 휠 버튼",
            },
            {
              title: "기준점 기록",
              code: "gestureRef",
              result: "시작 마우스·대상 좌표 저장",
            },
            {
              title: "이동 중 반복",
              code: "moveGesture",
              result: "delta 계산 · 대상 상태 변경",
            },
            {
              title: "놓기",
              code: "endGesture → clearGesture",
              result: "드래그 정보·포인터 캡처 정리",
            },
          ]}
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-neutral-800 p-5">
            <h4 className="text-lg font-medium">노드 이동</h4>
            <code className="mt-3 block text-sm leading-7 break-words text-violet-200">
              시작 position + delta / zoom
            </code>
            <p className="mt-3 text-sm leading-7 text-neutral-300">
              setWorkspace → 노드 position → left / top
            </p>
          </div>
          <div className="rounded-xl border border-neutral-800 p-5">
            <h4 className="text-lg font-medium">화면 이동</h4>
            <code className="mt-3 block text-sm leading-7 break-words text-violet-200">
              시작 camera + delta
            </code>
            <p className="mt-3 text-sm leading-7 text-neutral-300">
              setCamera → camera.x/y → translate
            </p>
          </div>
        </div>
      </article>

      <article
        id="flow-camera"
        aria-labelledby="flow-camera-title"
        className={panelClass}
      >
        <p className="font-mono text-sm text-violet-300">03 / CAMERA</p>
        <h3 id="flow-camera-title" className="mt-3 text-2xl font-semibold">
          입력 위치에 따라 휠 동작을 분리
        </h3>
        <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">입력에 따른 처리 함수와 결과</caption>
            <thead className="bg-neutral-950 text-neutral-400">
              <tr>
                {["입력", "처리", "결과"].map((heading) => (
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
                  "캔버스 위 휠",
                  "handleWheel → setCamera",
                  "포인터 기준 확대·축소",
                ],
                [
                  "본문 위 휠",
                  "handleWheel에서 return",
                  "본문 스크롤 · camera 유지",
                ],
                [
                  "화면 맞춤 버튼",
                  "fitCanvas → setCamera",
                  "전체 캔버스를 중앙에 배치",
                ],
                [
                  "뷰포트 크기 변경",
                  "ResizeObserver → fitCanvas",
                  "같은 화면 맞춤 계산 재사용",
                ],
              ].map(([input, handler, result]) => (
                <tr key={input} className="border-t border-neutral-800">
                  <th
                    scope="row"
                    className="px-5 py-4 font-normal text-neutral-200"
                  >
                    {input}
                  </th>
                  <td className="px-5 py-4 font-mono text-xs text-violet-200">
                    {handler}
                  </td>
                  <td className="px-5 py-4 text-neutral-300">{result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <FlowRow
          steps={[
            {
              title: "휠 입력",
              code: "handleWheel",
              result: "입력 영역·드래그 여부 확인",
            },
            {
              title: "기준 좌표 계산",
              code: "(pointerX - x) / zoom",
              result: "마우스 아래 캔버스 좌표",
            },
            {
              title: "새 카메라 계산",
              code: "setCamera",
              result: "새 배율에서도 같은 지점 유지",
            },
            {
              title: "화면 반영",
              code: "translate + scale",
              result: "노드의 문서 좌표는 그대로",
            },
          ]}
        />
      </article>

      <article
        id="flow-lifecycle"
        aria-labelledby="flow-lifecycle-title"
        className={panelClass}
      >
        <p className="font-mono text-sm text-violet-300">04 / LIFECYCLE</p>
        <h3 id="flow-lifecycle-title" className="mt-3 text-2xl font-semibold">
          진입 시 초기화, 이탈 시 정리
        </h3>
        <FlowRow
          steps={[
            {
              title: "프로젝트 진입",
              code: "ProjectPage",
              result: "URL의 projectId를 Workspace에 전달",
            },
            {
              title: "상태 초기화",
              code: "useState(createWorkspace)",
              result: "빈 문서·카메라·선택 상태 준비",
            },
            {
              title: "DOM 연결 후",
              code: "useEffect",
              result: "wheel·blur 등록 · 크기 관찰",
            },
            {
              title: "페이지를 나갈 때",
              code: "effect cleanup",
              result: "이벤트 제거 · observer 해제",
            },
          ]}
        />
        <p className="mt-5 text-sm text-neutral-400">
          현재 문서는 브라우저 메모리에서 관리합니다.
        </p>
      </article>
    </div>
  );
}
