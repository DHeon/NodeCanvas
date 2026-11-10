// 9주차 이후 추가 기능: 사용자 조작 → 실행되는 함수 → 결과 순서로 정리한다.
export const workflows = [
  {
    id: "autosave",
    title: "자동 저장",
    action: "노드를 옮기거나 메모를 쓰고 손을 뗀다.",
    result:
      "약 1.5초 뒤 서버에 저장되고 헤더에 ‘저장됨 · 오전 11:01’이 뜬다. 저장 버튼과 Ctrl+S는 즉시 저장이다.",
    steps: [
      {
        fn: "dispatchHistory → rootDocument 변경",
        detail:
          "편집할 때마다 루트 문서 객체가 바뀐다. 마지막 저장 문서(savedDocument)와 다르면 hasUnsavedChanges가 true가 된다.",
      },
      {
        fn: "useAutosave({ document, pending, failed })",
        detail:
          "document가 바뀔 때마다 타이머를 다시 1.5초로 잰다. 계속 편집하는 동안은 저장하지 않고, 멈추면 한 번만 저장한다.",
      },
      {
        fn: "isBusy() → 0.5초 뒤 다시 확인",
        detail:
          "드래그 중이거나 이미지 업로드·저장 중이면 바로 저장하지 않고 잠시 미룬다.",
      },
      {
        fn: "saveWorkspace() → saveWorkspaceDocument(PUT)",
        detail:
          "기존 저장 함수를 그대로 쓴다. 문서 버전을 함께 보내 다른 화면과의 충돌을 서버가 확인한다. 통신 오류면 10초 뒤 다시 시도한다.",
      },
      {
        fn: "unmount → keepalive PUT",
        detail:
          "뒤로 가기 등으로 편집기를 떠나면 남은 변경을 keepalive 요청으로 마지막으로 보낸다.",
      },
    ],
    file: "src/features/workspace/use-autosave.ts · workspace.tsx",
    code: `// workspace.tsx
useAutosave({
  document: rootDocument,
  pending: hasUnsavedChanges && !hasConflict
    && (!saveError || saveRetryable),
  failed: !!saveError,
  save: saveWorkspace,
  isBusy: () => savingRef.current
    || !!gestureRef.current
    || imageUploads.isUploading,
});

// use-autosave.ts
useEffect(() => {
  if (!pending) return;
  const attempt = () => {
    if (busyRef.current()) {
      timer = setTimeout(attempt, 500);
      return;
    }
    void saveRef.current();
  };
  timer = setTimeout(attempt,
    failed ? 10000 : 1500);
  return () => clearTimeout(timer);
}, [document, pending, failed]);`,
  },
  {
    id: "conflict",
    title: "저장 충돌 복구",
    action: "같은 프로젝트를 두 탭에서 열고, 한쪽에서 먼저 저장한다.",
    result:
      "늦게 저장한 탭 위에 노란 안내가 뜨고, 세 가지 중 하나를 고른다. 편집 내용은 사라지지 않는다.",
    steps: [
      {
        fn: "saveWorkspaceDocument → 409",
        detail:
          "서버의 문서 버전이 보낸 expectedVersion과 다르면 저장을 거절한다. setHasConflict(true)로 자동 저장도 멈춘다.",
      },
      {
        fn: "ConflictPanel",
        detail:
          "‘내 편집 내려받기’, ‘서버 버전 불러오기’, ‘내 편집으로 덮어쓰기’ 세 버튼을 보여준다.",
      },
      {
        fn: "exportDocument()",
        detail:
          "하위 공간까지 포함한 지금 문서를 JSON 파일로 내려받는다. 파일 메뉴에서도 쓸 수 있다.",
      },
      {
        fn: "overwriteServerVersion()",
        detail:
          "서버의 최신 버전 번호를 먼저 받아 온 뒤, 그 번호로 지금 문서를 저장해 덮어쓴다.",
      },
    ],
    file: "src/features/workspace/workspace.tsx · conflict-panel.tsx",
    code: `async function overwriteServerVersion() {
  if (!window.confirm("...덮어쓸까요?")) return;
  setConflictBusy(true);
  try {
    const server = await loadWorkspaceDocument(projectId);
    documentVersionRef.current = server.documentVersion;
    unconfirmedSaveRef.current = null;
    setHasConflict(false);
    await saveWorkspace({ overwrite: true });
  } finally {
    setConflictBusy(false);
  }
}`,
  },
  {
    id: "shortcuts",
    title: "키보드 단축키",
    action:
      "캔버스에서 T를 누르고 바로 글을 쓴다. 노드를 고르고 방향키, Ctrl+D, Ctrl+A를 누른다.",
    result:
      "텍스트 노드가 생기며 본문에 커서가 들어가고, 선택한 노드가 8px(Shift는 40px)씩 움직이거나 복제된다.",
    steps: [
      {
        fn: "handleWorkspaceKeyDown",
        detail:
          "Ctrl+S는 입력칸 안에서도 먼저 처리한다. 그 밖의 키는 입력칸·한글 조합 중이면 건너뛴다.",
      },
      {
        fn: "handleEditorShortcut",
        detail:
          "T/I/C는 addNode, +/−/0은 zoomBy·fitCanvas, Ctrl+A는 전체 선택, Ctrl+D는 duplicateSelection으로 보낸다.",
      },
      {
        fn: "nudgeSelection(dx, dy)",
        detail:
          "선택 노드 전체를 한 덩어리로 옮긴다. 유한 캔버스면 덩어리 전체가 경계 안에 남도록 이동량을 줄인다.",
      },
      {
        fn: "duplicateNodes → cloneNode",
        detail:
          "선택 노드와 그 사이 연결선을 복제한다. 캔버스 노드는 하위 문서 속 ID까지 새로 만들어 프로젝트 전체 ID가 겹치지 않게 한다.",
      },
      {
        fn: "focusAfterRenderRef",
        detail:
          "새 텍스트 노드가 그려진 다음 그 노드의 textarea에 포커스를 준다.",
      },
    ],
    file: "src/features/workspace/workspace.tsx · node-clone.ts",
    code: `const createActions = {
  t: () => addNode("text_node"),
  i: () => {
    const nodeId = addNode("image_node");
    if (nodeId) chooseImage(nodeId);
  },
  c: () => addNode("canvas_node"),
};

if (event.key.startsWith("Arrow") && selectedNodeIds.length) {
  const step = event.shiftKey ? 40 : 8;
  nudgeSelection(dx, dy);
}

// 새 텍스트 노드에 바로 입력
if (type === "text_node")
  focusAfterRenderRef.current = node.id;`,
  },
  {
    id: "image-viewer",
    title: "이미지 크게 보기",
    action:
      "이미지 노드를 더블클릭한다(또는 노드 오른쪽 위 확대 버튼, 속성의 ‘크게 보기’).",
    result:
      "화면 가득 이미지가 뜨고, ‘원본 크기’로 1:1로 볼 수 있다. Esc·바깥 클릭으로 닫으면 포커스가 노드로 돌아온다.",
    steps: [
      {
        fn: "ImageNodeView onDoubleClick → openImageViewer",
        detail:
          "이미지가 있고 업로드 중이 아니면 보기 창을 열 노드 ID를 상태(viewerNodeId)에 넣는다. 더블클릭이 남긴 글자 선택은 지운다.",
      },
      {
        fn: "ImageViewer → dialog.showModal()",
        detail:
          "네이티브 dialog의 모달로 열어 포커스 가두기·Esc 닫기·배경 비활성화를 브라우저에 맡긴다.",
      },
      {
        fn: "onKeyDown / onPaste → stopPropagation",
        detail:
          "보기 창에서 누른 Delete·Ctrl+Z·붙여넣기가 뒤쪽 편집기 문서를 바꾸지 않게 막는다.",
      },
      {
        fn: "onClose → setViewerNodeId(null)",
        detail:
          "닫히면 열기 전에 포커스가 있던 노드로 되돌린다. 개발 모드의 effect 재실행 때문에 정리 함수에서는 close()를 부르지 않는다.",
      },
    ],
    file: "src/features/workspace/image-viewer.tsx · image-node-view.tsx",
    code: `// image-node-view.tsx
onDoubleClick={(event) => {
  if (!node.image || uploading) return;
  event.stopPropagation();
  window.getSelection()?.removeAllRanges();
  onOpenImage(node.id);
}}

// image-viewer.tsx
useEffect(() => {
  const dialog = dialogRef.current;
  if (!dialog || dialog.open) return;
  previousFocusRef.current = document.activeElement;
  dialog.showModal();
}, []);`,
  },
  {
    id: "pan",
    title: "트랙패드·Space로 화면 이동",
    action:
      "트랙패드를 두 손가락으로 쓸거나, Space를 누른 채 드래그한다. Ctrl+휠·핀치는 확대한다.",
    result:
      "마우스 가운데 버튼이 없어도 화면을 옮길 수 있다. 헤더의 −/%/+로도 확대·축소한다.",
    steps: [
      {
        fn: "handleWheel → trackpadScroll 판별",
        detail:
          "픽셀 단위이면서 가로 이동이 있거나 이동량이 작은·소수면 트랙패드로 보고 카메라 x·y만 바꾼다. 마우스 휠은 지금처럼 확대한다.",
      },
      {
        fn: "keydown Space → spaceHeldRef",
        detail:
          "입력칸이 아닐 때 Space를 누르고 있으면 커서를 grab으로 바꾼다.",
      },
      {
        fn: "startPan (pointerdown capture)",
        detail:
          "가운데 버튼이거나 Space를 누른 왼쪽 버튼이면 범위 선택 대신 화면 이동을 시작한다.",
      },
    ],
    file: "src/features/workspace/workspace.tsx",
    code: `const trackpadScroll =
  !event.ctrlKey && !event.metaKey &&
  event.deltaMode === WheelEvent.DOM_DELTA_PIXEL &&
  (event.deltaX !== 0 ||
    !Number.isInteger(event.deltaY) ||
    Math.abs(event.deltaY) < 50);

if (trackpadScroll || event.shiftKey) {
  setCamera((current) => ({
    ...current,
    x: current.x - dx,
    y: current.y - dy,
  }));
  return;
}

// startPan
const spacePan =
  event.button === 0 && spaceHeldRef.current;
if (event.button !== 1 && !spacePan) return;`,
  },
  {
    id: "view",
    title: "보기 설정: 각진 선·점 배경",
    action: "메뉴바 ‘보기’에서 연결선 모양을 ‘각진 선’으로, 점 배경을 끈다.",
    result:
      "지금 열린 캔버스의 모든 연결선이 90도로 꺾이고 점 격자가 사라진다. 하위 캔버스는 각자 따로 정한다.",
    steps: [
      {
        fn: "WorkspaceMenu → onViewChange",
        detail:
          "라디오(곡선/각진 선)와 체크박스(점 배경)가 바뀌면 바로 부모에 알린다.",
      },
      {
        fn: "changeView(patch)",
        detail:
          "현재 공간 문서의 canvas.lineStyle·canvas.grid만 바꾼다. Undo 이력과 자동 저장에 그대로 들어간다.",
      },
      {
        fn: "getStyledConnectionPath(style, …)",
        detail:
          "곡선이면 기존 베지어, 각진 선이면 orthogonalPoints로 꺾이는 점을 만들고 roundedPolyline으로 모서리를 8px 둥글린다.",
      },
      {
        fn: "inheritViewSettings",
        detail:
          "새 캔버스 노드를 만들 때 부모 공간의 선 모양·점 배경을 하위 문서에 복사한다.",
      },
    ],
    file: "src/features/workspace/connections.ts · workspace.tsx",
    code: `function changeView(patch) {
  dispatchHistory({ type: "commit" });
  setWorkspace((current) => ({
    ...current,
    canvas: { ...current.canvas, ...patch },
  }));
}

// 가로로 나가는 연결: 마주 보면 가운데에서 꺾기
if ((b.x - a.x) * out >= 0) {
  const midX = (a.x + b.x) / 2;
  return [start,
    { x: midX, y: start.y },
    { x: midX, y: end.y },
    end];
}
// 세로 연결은 x·y를 바꿔 같은 규칙 사용
if (!isHorizontal(sourceSide))
  return orthogonalPoints(swap(start), ...).map(swap);`,
  },
  {
    id: "line-color",
    title: "연결선마다 다른 색",
    action: "연결선을 클릭하고 속성 패널에서 8가지 색 중 하나를 고른다.",
    result: "그 선만 색이 바뀐다. 노드의 연결 목록에도 같은 색 점이 보인다.",
    steps: [
      {
        fn: "selectConnection → WorkspaceProperties",
        detail:
          "연결선이 선택되면 속성 패널이 ‘연결선’ 모드로 바뀌어 잇는 노드와 색 선택, 삭제 버튼을 보여준다.",
      },
      {
        fn: "setConnectionColor(id, color)",
        detail:
          "해당 연결선의 color만 바꾼다. 기본색(lichen)은 저장하지 않아 이전 문서와 같은 모양을 유지한다.",
      },
      {
        fn: "connectionColor(key) → ConnectionLayer",
        detail:
          "저장된 이름을 실제 색으로 바꿔 선을 그린다. 선택된 선은 같은 색의 옅은 띠를 깔고 3px로 굵게 그린다.",
      },
    ],
    file: "src/features/workspace/connection-colors.ts · connection-layer.tsx",
    code: `// 색은 값이 아니라 이름으로 저장 (나중에 테마별로 바꿔 보여주기 위해)
export const CONNECTION_COLORS = [
  { key: "lichen", label: "이끼 회색", value: "#697164" },
  { key: "moss",   label: "이끼색",   value: "#7a8f52" },
  { key: "rose",   label: "장미",     value: "#c0567a" },
  // … 8색
] as const;

// workspace-schema.ts
const connectionSchema = z.strictObject({
  id: z.uuid(),
  source: endpointSchema,
  target: endpointSchema,
  color: z.enum(CONNECTION_COLOR_KEYS).optional(),
});`,
  },
  {
    id: "text-style",
    title: "텍스트 노드 글자 스타일",
    action:
      "텍스트 노드를 선택하고 속성의 ‘글자 스타일’에서 글꼴 목록, 크기, 정렬, 굵게, 글자 색을 바꾼다.",
    result:
      "그 노드의 글 전체가 바로 바뀌고 자동 저장된다. 예전 메모는 기본 모양 그대로 열린다.",
    steps: [
      {
        fn: "TextStyleSection → FontPicker",
        detail:
          "글꼴은 앞으로 늘어날 수 있어 펼치는 목록으로 두고, 각 항목을 그 글꼴로 미리 보여준다. 방향키로 고르고 Enter로 닫는다.",
      },
      {
        fn: "updateTextStyle(nodeId, patch)",
        detail: "Undo 이력을 확정한 뒤 해당 텍스트 노드의 textStyle만 바꾼다.",
      },
      {
        fn: "mergeTextStyle(current, patch)",
        detail:
          "기본값과 같은 항목은 지우고, 모두 기본이면 textStyle 자체를 없애 이전 문서와 같은 모양을 유지한다.",
      },
      {
        fn: "resolveTextStyle → TextNodeView",
        detail:
          "저장된 이름을 글꼴·크기·정렬 클래스와 글자 색으로 바꿔 textarea에 입힌다. 한글 웹폰트는 next/font로 직접 호스팅한다.",
      },
    ],
    file: "src/features/workspace/text-style.ts · text-style-section.tsx",
    code: `export const TEXT_FONTS = [
  { key: "sans",  label: "기본",   className: "font-sans" },
  { key: "serif", label: "명조",   className: "font-serif" },
  { key: "hand",  label: "손글씨", className: "font-hand" },
  { key: "mono",  label: "고정폭", className: "font-code" },
] as const;

export function mergeTextStyle(current, patch) {
  const next = { ...current, ...patch };
  for (const key of Object.keys(next))
    if (next[key] === undefined
      || next[key] === DEFAULT_TEXT_STYLE[key])
      delete next[key];
  return Object.keys(next).length ? next : undefined;
}`,
  },
  {
    id: "onboarding",
    title: "가입부터 첫 프로젝트까지",
    action:
      "회원가입 후 대시보드에서 첫 프로젝트 이름을 쓰고 ‘만들기’를 누른다.",
    result:
      "다시 로그인하지 않고 환영 화면으로 가고, 프로젝트 카드에 노드 배치 미리보기와 수정 시각이 보인다.",
    steps: [
      {
        fn: "SignupForm → authClient.signUp.email",
        detail:
          "서버 설정(autoSignIn: false)은 그대로 두고, 가입 성공 직후 같은 입력으로 signIn.email을 한 번 더 보낸다.",
      },
      {
        fn: "DashboardPage (프로젝트 0개)",
        detail:
          "‘환영해요, ○○님’ 카드와 입력칸에 포커스가 간 만들기 폼을 보여준다.",
      },
      {
        fn: "readPreview(document) → ProjectPreview",
        detail:
          "저장된 JSON에서 최상위 노드의 위치·크기만 꺼내 SVG로 축소해 그린다. formatUpdatedAt이 ‘3분 전’ 같은 시간을 만든다.",
      },
    ],
    file: "src/features/auth/signup-form.tsx · projects/project-preview.tsx",
    code: `const { error } = await authClient.signUp.email({
  name, email, password,
});
if (error) { /* 오류 표시 */ return; }

// 가입 직후 같은 입력으로 로그인
const signIn = await authClient.signIn.email({
  email, password,
});
if (!signIn.error) {
  window.location.replace("/dashboard");
  return;
}`,
  },
];

export const changes = [
  {
    label: "선 모양·점 배경",
    location: "project.document → canvas.lineStyle, canvas.grid",
    detail:
      "공간(하위 캔버스)마다 따로 저장한다. 값이 없는 이전 문서는 곡선·점 배경 표시로 열린다.",
  },
  {
    label: "글자 스타일",
    location: "project.document → nodes[].textStyle",
    detail:
      "텍스트 노드마다 글꼴·크기·굵게·정렬·색을 이름으로 저장한다. 기본값은 저장하지 않는다.",
  },
  {
    label: "연결선 색",
    location: "project.document → connections[].color",
    detail:
      "팔레트 이름만 저장하고 허용된 이름인지 zod로 검사한다. 기본색은 저장하지 않는다.",
  },
  {
    label: "현재 열린 공간",
    location: "URL ?canvas=<노드 ID>.<노드 ID>",
    detail: "뒤로 가기·새로고침·링크에서 같은 공간이 열린다.",
  },
  {
    label: "자동 저장 상태",
    location: "React 상태 (savedDocument, lastSavedAt)",
    detail:
      "브라우저 저장소(localStorage 등)에는 문서를 남기지 않는다. 서버만 기준이다.",
  },
  {
    label: "디자인 기준",
    location: "DESIGN.md · globals.css @theme",
    detail:
      "세이지 색·그림자를 토큰으로 정의해 로그인·대시보드·랜딩·편집기가 같은 색을 쓴다.",
  },
];
