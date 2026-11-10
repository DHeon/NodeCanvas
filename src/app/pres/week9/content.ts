export const workflows = [
  {
    id: "create",
    title: "캔버스 노드 생성",
    action: "왼쪽 도구바에서 캔버스 노드를 추가한다.",
    result: "현재 캔버스에 ‘새 작업 공간’ 카드가 생긴다.",
    steps: [
      {
        fn: 'onAddCanvasNode → addNode("canvas_node")',
        detail:
          "노드 ID와 위치를 정하고, createWorkspace()로 비어 있는 하위 문서를 만든다.",
      },
      {
        fn: "setWorkspace → updateWorkspaceAtPath",
        detail:
          "새 카드를 현재 경로의 nodes에 추가한다. 현재 공간과 그 상위 문서만 새 객체로 바뀐다.",
      },
      {
        fn: "CanvasNodeView",
        detail:
          "공통 NodeFrame으로 제목과 위치를 표시하고, 하위 공간의 노드 수와 열기 버튼을 보여준다.",
      },
    ],
    file: "src/features/workspace/workspace.tsx",
    code: `// addNode의 캔버스 노드 분기
{
  ...base,
  type: "canvas_node",
  title: "새 작업 공간",
  document: inheritViewSettings(
    createWorkspace(),
    workspace.canvas,
  ),
}

setWorkspace((current) => ({
  ...current,
  nodes: [...current.nodes, node],
}));`,
  },
  {
    id: "navigate",
    title: "하위 공간 열기와 돌아가기",
    action: "노드의 ‘열기’를 누르고, 상단 경로에서 ‘상위 작업 공간’을 누른다.",
    result: "같은 프로젝트 페이지에서 현재 그릴 문서만 바뀐다.",
    steps: [
      {
        fn: "CanvasNodeView → openCanvas(nodeId)",
        detail:
          "현재 캔버스에 있는 캔버스 노드인지 확인한 뒤, 경로의 끝에 해당 노드 ID를 붙인다.",
      },
      {
        fn: "navigateCanvas → writeCanvasPath",
        detail:
          "진행 중인 편집을 Undo 이력에 확정하고 선택을 비운다. pushState로 URL의 canvas 값을 갱신한다.",
      },
      {
        fn: "useSearchParams → resolveWorkspacePath",
        detail:
          "루트부터 ID를 하나씩 찾아 node.document로 내려간다. 상위로 갈 때는 마지막 ID를 뺀다. 경로가 끊겼다면 유효한 가장 가까운 상위 공간을 표시한다.",
      },
    ],
    file: "src/features/workspace/workspace.tsx · workspace-tree.ts",
    code: `// 열기: 현재 경로에 노드 ID 추가
navigateCanvas([
  ...canvasPath.slice(0, activeDepth),
  nodeId,
]);

// 상위로: 마지막 ID 제거
navigateCanvas(canvasPath.slice(0, activeDepth - 1));

// resolveWorkspacePath 내부: ID 순서대로 탐색
for (const id of path) {
  const node = document.nodes.find((n) => n.id === id);
  if (node?.type !== "canvas_node") break;
  trail.push(node);
  document = node.document;
}`,
  },
  {
    id: "camera",
    title: "돌아올 때 화면 위치·줌 복원",
    action: "상위 공간을 확대하거나 이동한 다음 하위 공간을 열고 돌아온다.",
    result: "하위 공간에 들어가기 직전의 위치와 배율이 복원된다.",
    steps: [
      {
        fn: "canvasKey → useLayoutEffect",
        detail:
          "경로가 바뀌면 이전 캔버스의 카메라 값(x, y, zoom)을 이전 경로 키에 보관한다.",
      },
      {
        fn: "canvasCamerasRef → setCamera / fitCanvas",
        detail:
          "돌아온 공간의 카메라가 있으면 다시 적용한다. 처음 방문한 공간이면 화면 맞춤으로 시작한다.",
      },
      {
        fn: "ResizeObserver",
        detail:
          "관찰을 시작할 때 크기가 그대로라면 다시 화면 맞춤을 하지 않는다. 초기 알림이 복원 값을 덮어쓰는 것을 막는다.",
      },
    ],
    file: "src/features/workspace/workspace.tsx",
    code: `if (switchedCanvas && previousKey !== null) {
  canvasCamerasRef.current.set(
    previousKey,
    latestCameraRef.current,
  );
}
previousCanvasKeyRef.current = canvasKey;

const savedCamera = switchedCanvas
  ? canvasCamerasRef.current.get(canvasKey)
  : undefined;
if (savedCamera) setCamera(savedCamera);
else fitCanvas();`,
  },
  {
    id: "save",
    title: "하위 공간 편집과 서버 저장",
    action: "하위에서 노드나 연결선을 수정하고 저장한 뒤 다시 연다.",
    result:
      "하위 공간까지 함께 복원된다. 하위 공간마다 별도 프로젝트 행을 만들지 않는다.",
    steps: [
      {
        fn: "setWorkspace → updateWorkspaceAtPath",
        detail:
          "현재 하위 문서를 수정하고, 바뀐 문서를 상위 캔버스 노드에 되돌려 넣어 rootDocument를 갱신한다.",
      },
      {
        fn: "saveWorkspace → saveWorkspaceDocument",
        detail:
          "저장 버튼과 자동 저장은 같은 함수를 호출한다. 보고 있는 하위 문서만 보내지 않고 rootDocument와 expectedVersion을 PUT으로 보낸다.",
      },
      {
        fn: "PUT document → prisma.project.updateMany",
        detail:
          "서버가 소유자, 중첩 문서 형식, 이미지 소속을 확인한다. 버전이 맞으면 document를 갱신하고 버전을 올린다. 다시 열 때 ProjectPage가 그 문서를 읽는다.",
      },
    ],
    file: "src/features/workspace/workspace.tsx · workspace-save-client.ts",
    code: `const documentToSave = rootDocument;
const versionToSave = documentVersionRef.current;

const version = await saveWorkspaceDocument(
  projectId,
  documentToSave,
  versionToSave,
);
documentVersionRef.current = version;
setSavedDocument(documentToSave);`,
  },
] as const;

export const storage = [
  {
    label: "캔버스 내용",
    location: "project.document (JSONB)",
    detail: "하위 노드·연결선·캔버스 설정까지 루트 문서에 중첩해서 저장한다.",
  },
  {
    label: "현재 열린 공간",
    location: "URL의 ?canvas=…",
    detail:
      "캔버스 노드 ID 경로. 저장된 노드라면 새로고침 후에도 같은 공간을 찾을 수 있다.",
  },
  {
    label: "화면 위치와 줌",
    location: "canvasCamerasRef",
    detail:
      "현재 페이지를 열어 둔 동안만 보관한다. 새로고침하거나 프로젝트를 다시 열면 초기화된다.",
  },
] as const;
