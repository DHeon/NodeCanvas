type Step = [from: number, to: number, label: string];
type Sequence = {
  id: string;
  title: string;
  category: string;
  code: string;
  changes: string;
  actors: string[];
  steps: Step[];
  choice?: { at: number; cases: string[] };
  loop?: { from: number; to: number; label: string };
  variants: [action: string, handler: string, difference: string][];
  note: string;
};

const sequences: Sequence[] = [
  {
    id: "document",
    title: "노드 생성·편집·선택·삭제",
    category: "문서와 선택 상태",
    code: "addTextNode · updateTextNode · setSelectedNodeId · deleteSelectedNode",
    changes: "workspace.nodes · selectedNodeId (생성 시 camera도 변경)",
    actors: ["사용자", "버튼 / TextNodeView", "Workspace", "React / DOM"],
    steps: [
      [0, 1, "버튼 클릭 · 글 입력 / 노드 선택 · 빈 공간 클릭"],
      [1, 2, "동작에 연결된 핸들러 실행"],
      [2, 2, "alt · 사용자 동작에 따른 처리"],
      [2, 3, "해당 상태 업데이트 요청"],
      [3, 1, "노드 목록 · value · 선택 표시 / 변경된 상태를 화면에 반영"],
    ],
    choice: {
      at: 2,
      cases: [
        "생성 → addTextNode: 새 노드 추가 + 선택 + 카메라 중앙 배치",
        "편집 → updateTextNode: ID가 일치하는 노드에 title/text 적용",
        "선택 → setSelectedNodeId(id): 문서 내용은 유지",
        "빈 공간 → setSelectedNodeId(null): 선택만 해제",
        "삭제 → deleteSelectedNode: 선택 ID를 제외하고 선택 해제",
      ],
    },
    variants: [
      ["생성", "addTextNode", "nodes 배열 추가 · 새 노드 ID 생성"],
      ["편집", "updateTextNode", "map으로 수정 대상만 교체"],
      [
        "선택 / 해제",
        "onSelect / 뷰포트 onPointerDown",
        "selectedNodeId만 변경",
      ],
      ["삭제", "deleteSelectedNode", "filter로 제외 · 선택 해제"],
    ],
    note: "하나의 동작에 해당하는 분기만 실행합니다. 빈 공간 클릭은 뷰포트가 직접 처리합니다. 선택되지 않은 상태의 삭제나 드래그 중 생성·삭제는 생략하며, 여러 상태 업데이트는 한 번의 렌더링으로 묶일 수 있습니다.",
  },
  {
    id: "drag",
    title: "노드·화면 드래그와 종료",
    category: "공통 Gesture 흐름",
    code: "startNodeDrag / startPan → moveGesture → endGesture / clearGesture",
    changes: "노드: position · 화면: camera.x/y · 공통: gestureRef",
    actors: ["사용자", "이동 버튼 / 뷰포트", "Workspace", "React / DOM"],
    steps: [
      [0, 1, "이동 버튼 왼쪽 누름 / 또는 휠 버튼 누름"],
      [1, 2, "startNodeDrag 또는 startPan / 시작 정보 저장 · 포인터 캡처"],
      [0, 2, "pointermove → moveGesture / 시작점 대비 delta 계산"],
      [2, 2, "alt · gesture.kind"],
      [2, 3, "해당 상태 업데이트 요청"],
      [3, 1, "노드 left/top / 또는 캔버스 translate 반영"],
      [0, 2, "버튼 해제 · 취소 · 창 전환 / clearGesture로 정리"],
    ],
    choice: {
      at: 3,
      cases: [
        'kind === "node" → 시작 position + delta / zoom → setWorkspace',
        'kind === "pan" → 시작 camera + delta → setCamera',
      ],
    },
    loop: {
      from: 2,
      to: 5,
      label: "loop · 누른 채로 포인터를 움직이는 동안",
    },
    variants: [
      [
        "노드 이동",
        "startNodeDrag",
        "왼쪽 버튼 · 배율 보정 · 캔버스 경계 제한",
      ],
      ["화면 이동", "startPan", "휠 버튼 · 노드 좌표 유지 · 카메라만 이동"],
      [
        "버튼 해제 / 취소 / 캡처 상실",
        "endGesture → clearGesture",
        "포인터 ID 확인 후 정보·캡처 정리",
      ],
      [
        "창 전환",
        "window blur → clearGesture",
        "endGesture를 거치지 않고 직접 정리",
      ],
    ],
    note: "드래그 종류가 달라도 시작 → 반복 이동 → 종료 구조는 같습니다. clearGesture는 gestureRef를 비우고 커서를 복구하며 남은 포인터 캡처를 해제합니다. 이미 움직인 위치를 되돌리는 기능은 아닙니다.",
  },
  {
    id: "camera",
    title: "확대·축소·스크롤·화면 맞춤",
    category: "입력에 따른 화면 처리",
    code: "handleWheel / fitCanvas / ResizeObserver",
    changes: "카메라 조작: camera.x/y/zoom · 본문 스크롤: textarea 스크롤 위치",
    actors: [
      "사용자 / 브라우저",
      "뷰포트 / Observer",
      "Workspace",
      "React / DOM",
    ],
    steps: [
      [0, 1, "휠 입력 · 화면 맞춤 클릭 / 최초 크기 통지 · 크기 변경"],
      [1, 2, "handleWheel 또는 fitCanvas"],
      [2, 2, "alt · 이벤트와 입력 영역"],
      [2, 3, "카메라 변경 분기만 / setCamera({ x, y, zoom })"],
      [3, 1, "캔버스 transform / 배율 표시 갱신"],
    ],
    choice: {
      at: 2,
      cases: [
        "입력 영역 위 휠 → return → 기본 본문 스크롤 (이후 단계 생략)",
        "캔버스 위 휠 → handleWheel: 포인터 아래 지점을 유지하며 줌",
        "맞춤 버튼 / ResizeObserver → fitCanvas: 전체 배율과 중앙 계산",
      ],
    },
    variants: [
      [
        "휠 확대·축소",
        "handleWheel",
        "포인터 기준 위치 보정 · 수동 배율 10~200%",
      ],
      [
        "입력 영역 스크롤",
        "handleWheel에서 조기 반환",
        "preventDefault 없음 · 브라우저 기본 스크롤",
      ],
      ["화면 맞춤 버튼", "fitCanvas", "뷰포트 측정 · 여백 반영 · 최대 100%"],
      [
        "최초 측정 / 창 크기 변경",
        "ResizeObserver → fitCanvas",
        "같은 맞춤 함수를 자동 호출",
      ],
    ],
    note: "각 이벤트는 해당 분기만 실행합니다. 입력 영역 위에서는 camera를 갱신하지 않습니다. 드래그 중에는 줌과 맞춤을 생략하고, 줌 한계에서 배율이 같으면 기존 camera를 유지합니다. 화면 맞춤은 수동 줌의 최소 10% 제한을 사용하지 않습니다.",
  },
  {
    id: "lifecycle",
    title: "프로젝트 진입·종료",
    category: "컴포넌트 생명주기",
    code: "ProjectPage → Workspace / createWorkspace / useEffect cleanup",
    changes: "진입: 빈 문서·카메라·선택 초기화 · 종료: 상태와 외부 등록 정리",
    actors: [
      "사용자 / Next.js",
      "ProjectPage",
      "Workspace",
      "브라우저 / React",
    ],
    steps: [
      [0, 1, "프로젝트 경로 진입"],
      [1, 2, "await params / projectId와 key 전달"],
      [2, 2, "useState(createWorkspace) / 초기 문서와 조작 상태 준비"],
      [2, 3, "작업 공간 표시 / DOM ref 연결 · effect 실행"],
      [2, 3, "wheel · blur 이벤트 등록 / ResizeObserver 관찰 시작"],
      [0, 3, "프로젝트 목록으로 이동 / Workspace 언마운트"],
      [3, 2, "effect cleanup 실행"],
      [2, 3, "이벤트 제거 · observer 해제 / 기존 상태 종료"],
    ],
    variants: [
      [
        "진입",
        "ProjectPage / createWorkspace",
        "ID 전달 · 빈 작업 공간 초기화",
      ],
      ["DOM 연결 후", "useEffect", "이벤트 등록 · 크기 관찰 (맞춤은 3번 흐름)"],
      [
        "작업 공간 이탈",
        "effect 정리 함수",
        "removeEventListener · disconnect",
      ],
      [
        "다시 새로 마운트",
        "useState 초기화",
        "현재 서버 저장이 없어 이전 문서 복원 안 됨",
      ],
    ],
    note: "서버 렌더링·hydration의 전송 상세를 생략한 흐름입니다. 프로젝트 페이지는 아직 DB 문서를 조회하지 않습니다. 이탈 시 저장 요청도 없으며, 다른 projectId key로 전환하거나 새로 마운트되면 상태를 새로 시작합니다.",
  },
];

// SVG의 메시지 라벨을 한글 폭을 고려해 줄바꿈한다.
function labelLines(label: string) {
  const lines: string[] = [];
  for (const part of label.split(" / ")) {
    let line = "";
    let width = 0;
    for (const character of part) {
      const size = character.charCodeAt(0) > 255 ? 2 : 1;
      if (width + size > 34) {
        lines.push(line);
        line = "";
        width = 0;
      }
      line += character;
      width += size;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function SequenceDiagram({ sequence }: { sequence: Sequence }) {
  const rowHeights = sequence.steps.map((_, index) =>
    sequence.choice?.at === index
      ? 74 + sequence.choice.cases.length * 28
      : 112,
  );
  const tops = rowHeights.map(
    (_, index) =>
      106 + rowHeights.slice(0, index).reduce((sum, height) => sum + height, 0),
  );
  const height = 130 + rowHeights.reduce((sum, row) => sum + row, 0);
  const x = (index: number) => 155 + index * 330;
  const y = (index: number) => tops[index] + 70;
  const marker = "sequence-arrow-" + sequence.id;
  const titleId = "sequence-title-" + sequence.id;

  return (
    <figure className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
      <div
        tabIndex={0}
        aria-label={sequence.title + " 다이어그램. 작은 화면에서는 가로 스크롤"}
        className="overflow-x-auto p-3 focus-visible:outline-2 focus-visible:outline-violet-400 sm:p-5"
      >
        <svg
          viewBox={"0 0 1300 " + height}
          role="img"
          aria-labelledby={titleId}
          aria-describedby={titleId + "-desc"}
          className="w-full min-w-[1000px]"
        >
          <title id={titleId}>{sequence.title}</title>
          <desc id={titleId + "-desc"}>
            {sequence.steps
              .map((step, index) => index + 1 + ". " + step[2])
              .join(". ")}{" "}
            {sequence.choice?.cases.join(". ")}
          </desc>
          <defs>
            <marker
              id={marker}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0 0 L8 4 L0 8 Z" fill="#c4b5fd" />
            </marker>
          </defs>
          {sequence.actors.map((actor, index) => (
            <g key={actor}>
              <rect
                x={x(index) - 135}
                y="12"
                width="270"
                height="58"
                rx="10"
                fill="#171717"
                stroke="#525252"
              />
              <text
                x={x(index)}
                y="47"
                textAnchor="middle"
                fill="#f5f5f5"
                fontSize="17"
                fontWeight="600"
              >
                {actor}
              </text>
              <line
                x1={x(index)}
                y1="70"
                x2={x(index)}
                y2={height - 15}
                stroke="#525252"
                strokeDasharray="5 6"
              />
            </g>
          ))}
          {sequence.loop && (
            <g>
              <rect
                x="10"
                y={tops[sequence.loop.from] - 5}
                width="1280"
                height={
                  tops[sequence.loop.to] +
                  rowHeights[sequence.loop.to] -
                  tops[sequence.loop.from] +
                  10
                }
                rx="10"
                fill="#8b5cf6"
                fillOpacity="0.04"
                stroke="#7c3aed"
                strokeDasharray="5 5"
              />
              <text
                x="26"
                y={tops[sequence.loop.from] + 16}
                fill="#c4b5fd"
                fontSize="13"
              >
                {sequence.loop.label}
              </text>
            </g>
          )}
          {sequence.steps.map(([from, to, label], index) => {
            if (sequence.choice?.at === index) {
              return (
                <g key={index}>
                  <rect
                    x="290"
                    y={tops[index] + 8}
                    width="930"
                    height={rowHeights[index] - 20}
                    rx="10"
                    fill="#211b33"
                    stroke="#8b5cf6"
                  />
                  <text
                    x="310"
                    y={tops[index] + 35}
                    fill="#c4b5fd"
                    fontSize="15"
                    fontWeight="600"
                  >
                    {label} · 해당 분기만 실행
                  </text>
                  {sequence.choice.cases.map((condition, caseIndex) => (
                    <text
                      key={condition}
                      x="310"
                      y={tops[index] + 66 + caseIndex * 28}
                      fill="#e5e5e5"
                      fontSize="15"
                    >
                      {condition}
                    </text>
                  ))}
                </g>
              );
            }
            const self = from === to;
            const center = self ? x(from) : (x(from) + x(to)) / 2;
            const lines = labelLines(index + 1 + ". " + label);
            return (
              <g key={index}>
                {self && (
                  <rect
                    x={center - 143}
                    y={y(index) - 53}
                    width="286"
                    height="55"
                    rx="7"
                    fill="#262626"
                  />
                )}
                <text
                  x={center}
                  textAnchor="middle"
                  fill="#e5e5e5"
                  fontSize="15"
                >
                  {lines.map((line, lineIndex) => (
                    <tspan
                      key={lineIndex}
                      x={center}
                      y={y(index) - 14 - (lines.length - 1 - lineIndex) * 20}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
                {self ? (
                  <path
                    d={
                      "M " +
                      x(from) +
                      " " +
                      (y(index) + 10) +
                      " h 78 v 23 h -78"
                    }
                    fill="none"
                    stroke="#c4b5fd"
                    strokeWidth="2"
                    markerEnd={"url(#" + marker + ")"}
                  />
                ) : (
                  <line
                    x1={x(from)}
                    y1={y(index)}
                    x2={x(to)}
                    y2={y(index)}
                    stroke="#c4b5fd"
                    strokeWidth="2"
                    markerEnd={"url(#" + marker + ")"}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="border-t border-neutral-800 px-5 py-4 text-sm leading-7 text-neutral-300">
        {sequence.note}
      </figcaption>
    </figure>
  );
}

export default function ActionSequences() {
  return (
    <div className="mt-8">
      <p className="text-sm leading-7 text-neutral-400">
        반복되는 흐름을 4개로 통합했습니다. 생성·편집 등을 차례로 실행하는
        그림이 아니라, 같은 구조에서 입력에 따라 다른 분기를 실행하는
        그림입니다. 상태 업데이트는 React에서 묶어 처리될 수 있습니다.
      </p>
      <p className="mt-3 text-xs leading-6 text-neutral-500">
        실선: 이벤트·호출·처리 전달 · 꺾인 화살표: 내부 처리 · alt: 조건별 처리
        요약 · loop: 반복
      </p>
      <div className="mt-6 space-y-4">
        {sequences.map((sequence, index) => (
          <details
            key={sequence.id}
            id={"action-" + sequence.id}
            open={index === 0}
            className="scroll-mt-6 rounded-2xl border border-neutral-800 bg-neutral-900/30"
          >
            <summary className="cursor-pointer rounded-2xl p-5 text-base font-medium text-neutral-100 hover:bg-neutral-800/40 focus-visible:outline-2 focus-visible:outline-violet-400 sm:p-6">
              <span className="mr-3 ml-2 font-mono text-sm text-violet-300">
                {String(index + 1).padStart(2, "0")}
              </span>
              {sequence.title}
              <span className="ml-3 text-xs font-normal text-neutral-400">
                {sequence.category}
              </span>
            </summary>
            <div className="space-y-4 px-3 pb-5 sm:px-6 sm:pb-6">
              <dl className="grid gap-3 rounded-xl border border-neutral-800 p-4 text-sm leading-7 sm:grid-cols-2">
                <div>
                  <dt className="text-neutral-500">관련 코드</dt>
                  <dd className="mt-1 font-mono text-xs leading-6 break-words text-violet-200">
                    {sequence.code}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">변경되는 값</dt>
                  <dd className="mt-1 text-neutral-300">{sequence.changes}</dd>
                </div>
              </dl>
              <SequenceDiagram sequence={sequence} />
              <div className="overflow-x-auto rounded-xl border border-neutral-800">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <caption className="px-4 py-3 text-left text-neutral-400">
                    그림 하나에서 달라지는 부분
                  </caption>
                  <thead className="border-y border-neutral-800 text-neutral-400">
                    <tr>
                      {["동작", "처리 함수", "차이"].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="px-4 py-3 font-medium"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sequence.variants.map(([action, handler, difference]) => (
                      <tr key={action} className="border-t border-neutral-800">
                        <th
                          scope="row"
                          className="px-4 py-3 font-normal text-neutral-200"
                        >
                          {action}
                        </th>
                        <td className="px-4 py-3 font-mono text-xs text-violet-200">
                          {handler}
                        </td>
                        <td className="px-4 py-3 leading-6 text-neutral-300">
                          {difference}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
