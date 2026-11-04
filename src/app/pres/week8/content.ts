export type Workflow = {
  id: string;
  title: string;
  action: string;
  result: string;
  steps: { event: string; fn: string; file: string; detail: string }[];
  snippets: { title: string; file: string; code: string }[];
  note: string;
};

const workspace = "src/features/workspace/workspace.tsx";
const connections = "src/features/workspace/connections.ts";
const properties = "src/features/workspace/workspace-properties.tsx";
const images = "src/features/workspace/use-image-uploads.ts";

export const workflows: Workflow[] = [
  {
    id: "connections",
    title: "연결선 생성과 스냅",
    action:
      "노드의 상하좌우 점에서 드래그하고, 다른 노드의 연결점 근처에서 놓기",
    result:
      "드래그 중에는 임시 선만 표시하고, 유효한 대상에 놓았을 때 연결 관계를 문서에 추가한다.",
    steps: [
      {
        event: "연결점 누름 · pointerdown",
        fn: "NodeFrame / startNodeConnection()",
        file: workspace,
        detail:
          "공통 NodeFrame의 연결점이 노드와 방향을 전달한다. gestureRef에 출발점과 포인터 ID를 기록하고 connectionDraft를 만든다. 뷰포트가 포인터를 캡처하므로 노드 밖에서도 드래그를 이어간다.",
      },
      {
        event: "드래그 · pointermove",
        fn: "moveGesture() / getCanvasPoint()",
        file: workspace,
        detail:
          "마우스 좌표에서 뷰포트 위치와 카메라 이동량을 빼고 zoom으로 나눈다. getConnectionHover가 실제 커서 아래 노드를 확인한 뒤 스냅 후보를 찾는다.",
      },
      {
        event: "대상 연결점에 접근",
        fn: "findConnectionTarget()",
        file: connections,
        detail:
          "각 연결점까지의 캔버스 거리에 zoom을 곱해 화면 거리를 계산한다. 18px 이내의 가장 가까운 유효 점에 붙이고 대상에 원을 표시한다. 스냅 전 점선은 스냅 후 실선으로 바뀐다.",
      },
      {
        event: "마우스 놓기 · pointerup",
        fn: "endGesture() / setWorkspace()",
        file: workspace,
        detail:
          "놓는 순간 대상을 다시 검사한다. UUID와 source·target을 connections 배열에 추가한다. 자기 노드와 중복 연결은 거절한다. 빈 공간, Escape, 창 전환에서는 연결하지 않는다.",
      },
      {
        event: "노드 이동 또는 크기 변경",
        fn: "ConnectionLayer / getConnectionPoint() / getConnectionPath()",
        file: "src/features/workspace/connection-layer.tsx",
        detail:
          "source·target의 nodeId로 현재 노드를 찾는다. 노드 위치·크기에서 끝점을 다시 계산하고, 방향에 따른 제어점으로 SVG 3차 베지어 곡선을 그린다. 노드가 바뀌면 선도 따라간다.",
      },
    ],
    snippets: [
      {
        title: "확대율과 무관하게 화면에서 18px 이내",
        file: `${connections} / findConnectionTarget()`,
        code: `const point = getConnectionPoint(node, side);
const distance =
  Math.hypot(point.x - pointer.x, point.y - pointer.y) * zoom;

if (distance <= nearestDistance) {
  nearest = { nodeId: node.id, side };
  nearestDistance = distance;
}`,
      },
      {
        title: "문서에는 좌표 대신 노드 ID와 방향 저장",
        file: "src/features/workspace/types.ts",
        code: `type NodeConnection = {
  id: string;
  source: { nodeId: string; side: ConnectionSide };
  target: { nodeId: string; side: ConnectionSide };
};

// side: "top" | "right" | "bottom" | "left"
// 화면은 노드의 현재 위치와 크기에서 끝점을 계산한다.`,
      },
    ],
    note: "이 곡선은 연결점 방향을 반영한다. 다른 노드나 장애물을 감지해서 우회하는 경로 탐색은 아직 없다.",
  },
  {
    id: "connection-delete",
    title: "연결선 선택과 삭제",
    action: "연결선을 클릭한 뒤 Delete 또는 선택 삭제 버튼 누르기",
    result:
      "선만 삭제하면 노드는 남는다. 노드를 삭제하면 그 노드에 연결된 선도 함께 제거한다.",
    steps: [
      {
        event: "얇은 연결선 클릭",
        fn: "ConnectionLayer.onPointerDown / selectConnection()",
        file: "src/features/workspace/connection-layer.tsx",
        detail:
          "보이는 선과 같은 경로에 화면 기준 14px의 투명 stroke를 겹쳐 클릭 영역을 넓힌다. 선택 시 selectedConnectionId를 기록하고 노드 선택은 비운다.",
      },
      {
        event: "Delete 또는 휴지통 버튼",
        fn: "handleWorkspaceKeyDown() / deleteSelection()",
        file: workspace,
        detail:
          "connections를 filter해서 선택한 ID를 제외한다. 노드 삭제 시에는 source나 target이 삭제 대상 노드인 선도 제외한다. 드래그 중에는 삭제를 막는다.",
      },
      {
        event: "문서 갱신과 실행 취소",
        fn: "setWorkspace() / workspaceHistoryReducer()",
        file: "src/features/workspace/workspace-history.ts",
        detail:
          "생성·삭제를 문서 변경 한 단계로 기록한다. Undo는 이전 connections 배열을 복원한다. 노드 삭제를 취소하면 노드와 연결선이 함께 돌아온다.",
      },
    ],
    snippets: [
      {
        title: "화면 선과 클릭 판정 영역을 분리",
        file: "src/features/workspace/connection-layer.tsx",
        code: `<path d={path} stroke="transparent" strokeWidth={14}
  vectorEffect="non-scaling-stroke"
  style={{ pointerEvents: "stroke" }}
  onPointerDown={() => onSelect(connection.id)} />
<path d={path} stroke={selected ? "#2563eb" : "#8b5cf6"}
  strokeWidth={selected ? 3 : 2}
  vectorEffect="non-scaling-stroke" />`,
      },
      {
        title: "선 삭제와 노드 삭제를 같은 통로에서 처리",
        file: `${workspace} / deleteSelection()`,
        code: `connections: current.connections.filter(
  (connection) =>
    connection.id !== selectedConnectionId &&
    !selectedNodeIds.includes(connection.source.nodeId) &&
    !selectedNodeIds.includes(connection.target.nodeId),
),`,
      },
    ],
    note: "선택 ID와 드래그 미리보기는 화면 상태다. 저장되는 연결 관계와 분리하므로 선택하거나 스냅 후보를 바꾸는 것만으로 문서를 수정하지 않는다.",
  },
  {
    id: "properties",
    title: "Properties에서 노드 편집",
    action: "노드 하나 선택 후 오른쪽에서 제목·위치·크기 또는 종류별 내용 수정",
    result:
      "Properties와 캔버스가 동일한 문서를 읽기 때문에 한쪽의 수정이 다른 쪽에도 바로 반영된다.",
    steps: [
      {
        event: "노드 하나 선택",
        fn: "selectNode() / selectedNode",
        file: workspace,
        detail:
          "selectedNodeIds의 ID로 실제 노드를 찾고 WorkspaceProperties에 전달한다. 여러 개 선택한 경우 일괄 편집 대신 안내를 보여준다. 열림 여부는 별도 propertiesOpen 상태로 유지한다.",
      },
      {
        event: "제목 또는 본문 입력",
        fn: "onChange() / updateTextNode()",
        file: `${properties} / ${workspace}`,
        detail:
          "Properties가 문서를 따로 복사하지 않고 부모 콜백에 nodeId와 변경값을 전달한다. Workspace가 해당 노드만 새 객체로 바꾸고 NodeFrame·종류별 본문을 다시 렌더링한다.",
      },
      {
        event: "X/Y/W/H 입력 후 Enter 또는 바깥 클릭",
        fn: "NumberField.onBlur / updateNodeTransform() / transformNode()",
        file: "src/features/workspace/node-transform.ts",
        detail:
          "입력 중에는 draft를 보관하고, 실제 수정한 유효 숫자만 확정한다. 유한 모드에서는 캔버스 범위로 제한하고 무한 모드에서는 음수 좌표도 허용한다. Esc는 취소한다. 이미지는 W나 H를 바꿔도 원본 비율을 유지한다.",
      },
      {
        event: "편집 종료 또는 패널 닫기",
        fn: "beginTextEdit() / endTextEdit() / setPropertiesOpen()",
        file: workspace,
        detail:
          "포커스와 blur를 begin·commit 이력에 연결해 편집을 묶는다. 닫기 화살표는 문서를 바꾸지 않고 패널만 닫는다. 닫은 뒤 노드를 다시 선택해도 자동으로 열지 않는다.",
      },
    ],
    snippets: [
      {
        title: "Properties는 변경 요청을 부모로 전달",
        file: `${properties} / WorkspaceProperties`,
        code: `onChange={(event) =>
  onChange(node.id, { title: event.target.value })
}

// Workspace가 문서 변경을 담당
onChange={updateTextNode}
onTransform={updateNodeTransform}
onEditStart={beginTextEdit}
onEditEnd={endTextEdit}`,
      },
      {
        title: "위치·크기 수정도 기존 문서 변경 통로 사용",
        file: `${workspace} / updateNodeTransform()`,
        code: `function updateNodeTransform(nodeId, patch) {
  if (!gestureRef.current)
    setWorkspace((current) =>
      transformNode(current, nodeId, patch),
    );
}

// transformNode: 유효 숫자 검사, 경계 제한, 비율 계산
// 변경된 노드만 교체하고 나머지 노드는 유지한다.`,
      },
    ],
    note: "공통 제목·좌표·크기는 NodeBase로 공유한다. node.type이 text_node이면 본문, image_node이면 이미지 선택·교체·제거와 파일 정보를 표시한다.",
  },
  {
    id: "images",
    title: "이미지 추가와 서버 저장",
    action:
      "빈 이미지 노드의 + 버튼으로 파일 선택 또는 Ctrl+V로 이미지 붙여넣기",
    result:
      "파일은 서버에 업로드하고 문서에는 이미지 ID와 메타데이터만 넣는다. 저장 버튼으로 노드 배치와 참조를 확정한다.",
    steps: [
      {
        event: "빈 노드 생성 후 이미지 선택",
        fn: "addNode() / chooseImage() / handlePaste()",
        file: workspace,
        detail:
          "도구바는 파일 창 없이 image: null인 노드를 만든다. + 또는 Properties에서 파일을 선택한다. 이미지 노드가 선택되어 있으면 교체하고, 빈 공간에서 붙여넣으면 새 이미지 노드를 만든다.",
      },
      {
        event: "파일 전송",
        fn: "useImageUploads.upload() / uploadWorkspaceImage()",
        file: images,
        detail:
          "클라이언트가 형식과 10MB 제한을 확인하고 바이너리를 POST한다. 업로드 상태와 오류를 표시한다. 같은 노드의 이전 요청은 취소하고, 업로드 중에는 문서 저장을 비활성화한다.",
      },
      {
        event: "서버 검증과 이미지 변환",
        fn: "POST / readImageBody() / normalizeImage()",
        file: "src/app/api/projects/[projectId]/images/route.ts",
        detail:
          "로그인·Origin·프로젝트 소유권을 확인한다. 실제 파일 시그니처와 스트림 용량을 검사하고 Sharp로 회전 보정·축소·WebP 변환한다. 최대 4천만 픽셀, 긴 변 2560px, 변환 후 5MB로 제한한다.",
      },
      {
        event: "이미지 저장과 노드 표시",
        fn: "prisma.imageAsset.create() / replaceNodeImage()",
        file: `${images} / src/features/workspace/node-transform.ts`,
        detail:
          "image_asset에 바이너리를 저장하고 id·width·height·byteLength를 반환한다. 아직 존재하는 이미지 노드에 참조를 적용한다. ImageNodeView는 소유권을 확인하는 이미지 GET 주소로 원본 비율에 맞춰 표시한다.",
      },
      {
        event: "저장 버튼 후 다시 열기",
        fn: "saveWorkspace() / PUT document / GET document",
        file: "src/app/api/projects/[projectId]/document/route.ts",
        detail:
          "문서 형식과 이미지 참조의 프로젝트 소속·메타데이터를 검증한다. expectedVersion이 일치할 때 project.document와 버전을 갱신한다. 다시 열면 노드·연결 관계·이미지 참조를 복원한다.",
      },
    ],
    snippets: [
      {
        title: "파일과 문서 참조를 분리",
        file: "src/features/workspace/types.ts / prisma/schema.prisma",
        code: `type ImageReference = {
  id: string;
  width: number;
  height: number;
  byteLength: number;
};

// image_asset: projectId, data(bytea), 크기·용량
// project.document: nodes, connections, image 참조
// Project 1 : N ImageAsset`,
      },
      {
        title: "업로드 응답을 살아 있는 노드에 적용",
        file: `${workspace} / useImageUploads 콜백`,
        code: `const imageUploads = useImageUploads(projectId, (nodeId, image) => {
  if (gestureRef.current) {
    pendingImagesRef.current.push({ nodeId, image });
    return;
  }
  dispatchHistory({ type: "commit" });
  setWorkspace((current) =>
    replaceNodeImage(current, nodeId, image),
  );
  // 입력칸 편집 중이면 다음 편집 이력을 다시 시작한다.
});`,
      },
    ],
    note: "이미지 업로드와 문서 저장은 별도다. 이미지 제거·교체 직후 파일까지 지우면 Undo가 깨질 수 있어 자산을 남겨 둔다. 현재는 프로젝트 삭제 시 함께 제거한다. 대량 사진용 저장소와 미사용 자산 정리는 후속 과제다.",
  },
  {
    id: "infinite-canvas",
    title: "무한 캔버스",
    action:
      "편집 메뉴에서 무한 캔버스를 선택하고 적용한 뒤, 휠 클릭 드래그로 화면 이동",
    result:
      "뷰포트 크기는 유지하면서 노드 배치의 경계 제한을 해제한다. 음수 좌표와 기존 가로·세로 크기 밖에도 노드를 놓을 수 있다.",
    steps: [
      {
        event: "편집 메뉴에서 모드 선택 후 적용",
        fn: "WorkspaceMenu.submit() / applyCanvasSettings()",
        file: "src/features/workspace/workspace-menu.tsx / canvas-settings.ts",
        detail:
          "메뉴에서 선택한 infinite 값을 부모에게 전달한다. applyCanvasSettings가 새 canvas 설정을 만들고 Workspace가 setWorkspace로 문서를 갱신한다. 무한 모드에서 가로·세로 값은 경계로 사용하지 않고 유한 모드로 돌아갈 설정값으로 남겨 둔다.",
      },
      {
        event: "노드 이동·생성 또는 Properties 좌표 수정",
        fn: "moveGesture() / addNode() / transformNode()",
        file: `${workspace} / src/features/workspace/node-transform.ts`,
        detail:
          "유한 모드의 이동량·생성 위치 제한을 무한 모드에서는 적용하지 않는다. Properties도 음수 좌표를 허용한다. 노드 ID와 연결 관계는 그대로 유지하므로 연결선은 새 위치에서 끝점을 다시 계산한다.",
      },
      {
        event: "휠 클릭 드래그 또는 마우스 휠",
        fn: "startPan() / moveGesture() / handleWheel()",
        file: workspace,
        detail:
          "화면을 이동할 때는 노드 좌표 대신 camera.x·y를 변경한다. 화면 위치는 노드 좌표 × zoom + 카메라 이동량으로 계산한다. 휠 확대·축소 시에는 커서 아래의 캔버스 좌표가 같은 화면 위치에 남도록 카메라도 함께 보정한다.",
      },
      {
        event: "점 배경 갱신",
        fn: "camera / gridStep / backgroundPosition",
        file: workspace,
        detail:
          "거대한 배경 이미지나 수많은 점 요소를 만들지 않고 뷰포트에 CSS radial-gradient를 반복한다. 배경 위치는 카메라 이동량, 점 간격은 확대율에 맞춘다. 축소 시에는 중간 점을 단계적으로 생략해 배경이 빽빽해지는 것을 줄인다.",
      },
      {
        event: "화면 맞춤 버튼",
        fn: "fitCanvas() / getFitCamera() / getNodeBounds()",
        file: "src/features/workspace/canvas-settings.ts",
        detail:
          "무한 공간 전체 대신 현재 노드들을 감싸는 left·top·right·bottom을 계산한다. 그 영역이 여백을 두고 들어오도록 확대율과 카메라 위치를 정한다. 노드가 없으면 보관한 가로·세로 값을 초기 화면 기준으로 사용한다.",
      },
      {
        event: "유한 모드로 전환 또는 저장 버튼",
        fn: "applyCanvasSettings() / workspaceDocumentSchema / saveWorkspace()",
        file: "src/features/workspace/canvas-settings.ts / workspace-schema.ts",
        detail:
          "유한 모드로 돌아갈 때는 전체 배치를 평행 이동해 노드 간격과 크기를 보존한다. 내용이 입력 크기보다 크면 적용을 거절하고 필요한 최소 크기를 안내한다. 저장 시 infinite와 노드 좌표를 JSONB에 함께 기록하며, 서버도 모드에 따라 경계 검사를 구분한다.",
      },
    ],
    snippets: [
      {
        title: "무한 모드에서는 노드 이동량의 경계 제한 해제",
        file: `${workspace} / moveGesture()`,
        code: `const moveX = current.canvas.infinite
  ? deltaX / gesture.zoom
  : Math.max(
      -gesture.bounds.left,
      Math.min(
        deltaX / gesture.zoom,
        current.canvas.width - gesture.bounds.right,
      ),
    );

// Y도 같은 방식으로 계산
const x = startPosition.x + moveX;
const y = startPosition.y + moveY;`,
      },
      {
        title: "화면 이동은 노드 좌표가 아닌 카메라 변경",
        file: `${workspace} / moveGesture() / 캔버스 style`,
        code: `// 휠 클릭 드래그 중
setCamera((current) => ({
  ...current,
  x: gesture.startCamera.x + deltaX,
  y: gesture.startCamera.y + deltaY,
}));

// 노드들을 담은 요소에 공통 변환 적용
transform: \`translate(\${camera.x}px, \${camera.y}px)
  scale(\${camera.zoom})\`

// 화면 좌표 = 캔버스 좌표 × zoom + camera 이동량`,
      },
      {
        title: "무한 공간 대신 노드 전체를 화면에 맞춤",
        file: "src/features/workspace/canvas-settings.ts / getFitCamera()",
        code: `const bounds = document.canvas.infinite
  ? getNodeBounds(document.nodes)
  : null;

const left = bounds?.left ?? 0;
const top = bounds?.top ?? 0;
const contentWidth = bounds
  ? bounds.right - left : document.canvas.width;
const contentHeight = bounds
  ? bounds.bottom - top : document.canvas.height;

// 이 영역이 뷰포트 안에 들어오도록 zoom과 camera 계산`,
      },
    ],
    note: "무한 크기의 DOM 요소를 생성하는 방식이 아니라 좌표 공간의 일부를 카메라로 보여주는 구조다. 모드·크기 변경도 Undo/Redo와 수동 저장에 포함한다. 현재는 모든 노드를 렌더링하며, 화면 밖 노드를 생략하는 최적화는 아직 적용하지 않았다.",
  },
];

// 같은 내용을 실제 작업 공간에서도 읽을 수 있도록 세 가지 흐름으로 요약한다.
export const canvasRows = [
  [
    {
      title: "01 연결선 · 점에서 드래그",
      text: "연결점 pointerdown\n\nNodeFrame이 노드 ID와 방향을 전달한다. startNodeConnection이 출발점을 기록하고 포인터를 캡처한다.\n\nconnectionDraft는 임시 화면 상태다. 아직 문서에 선을 저장하지 않는다.",
    },
    {
      title: "02 연결선 · 가까운 점에 스냅",
      text: "moveGesture / findConnectionTarget\n\n거리 × zoom ≤ 18px인 가장 가까운 유효 점을 찾는다. 대상 점에 원을 표시하고 미리보기 끝점을 붙인다.\n\n놓는 순간 다시 검사해 connections에 추가한다. 자기 연결과 중복 연결은 제외한다.",
    },
    {
      title: "03 연결선 · 곡선과 삭제",
      text: "ConnectionLayer / deleteSelection\n\n노드 ID로 현재 위치·크기를 찾아 끝점을 계산한다. 방향별 제어점으로 베지어 곡선을 그린다. 장애물 회피는 아니다.\n\n14px 투명 선으로 클릭 영역을 넓힌다. Delete로 삭제하고 Undo로 복원한다.",
    },
    {
      title: "04 연결선 · 저장되는 관계",
      text: "project.document.connections\n\nsource: { nodeId, side }\ntarget: { nodeId, side }\n\n좌표 대신 관계를 저장하므로 노드가 움직여도 선이 따라간다. 노드 삭제 시 관련 선도 함께 제거한다.\n\n저장 버튼으로 DB에 반영한다.",
    },
  ],
  [
    {
      title: "05 Properties · 노드 선택",
      text: "selectNode / selectedNode\n\n선택 ID로 노드를 찾아 오른쪽 패널에 전달한다. 여러 개 선택하면 안내만 표시한다.\n\n패널 열림은 propertiesOpen으로 관리한다. 한 번 닫으면 다른 노드를 눌러도 닫힘을 유지한다.",
    },
    {
      title: "06 Properties · 값 변경",
      text: "WorkspaceProperties / 콜백\n\n제목·본문은 updateTextNode에 변경값을 전달한다. 숫자는 draft에 입력한 뒤 Enter나 blur로 확정하고 Esc로 취소한다.\n\n패널은 문서를 따로 복사하지 않는다. Workspace가 문서 상태를 소유한다.",
    },
    {
      title: "07 Properties · 경계와 비율",
      text: "updateNodeTransform / transformNode\n\n유효 숫자만 받고 X/Y/W/H를 캔버스 범위로 제한한다.\n\n이미지는 fitNodeSize가 원본 비율과 제목 영역 48px을 고려한다. 위치가 바뀌면 연결선 끝점도 다시 계산한다.",
    },
    {
      title: "08 Properties · 화면과 이력",
      text: "setWorkspace / history.present\n\n새 node가 NodeFrame과 종류별 본문에 전달돼 캔버스가 갱신된다.\n\nbeginTextEdit와 endTextEdit로 편집을 묶어 Undo 한 번으로 되돌린다. 패널 표시 상태와 선택은 문서에 저장하지 않는다.",
    },
  ],
  [
    {
      title: "09 이미지 · 선택과 전송",
      text: "addNode / chooseImage / handlePaste\n\n빈 이미지 노드의 +로 파일을 선택한다. 선택된 이미지 노드에서 Ctrl+V는 교체, 빈 공간에서는 새 노드를 만든다.\n\nuseImageUploads가 형식·10MB를 확인하고 파일을 POST한다. 업로드 중에는 문서 저장을 막는다.",
    },
    {
      title: "10 이미지 · 서버 검증",
      text: "POST images / normalizeImage\n\n로그인·Origin·소유권을 확인한다. 실제 파일 시그니처와 용량을 검사한다.\n\nSharp가 회전 보정 후 긴 변 최대 2560px의 WebP로 변환한다. image_asset에 바이너리를 저장한다. GIF는 첫 프레임만 사용한다.",
    },
    {
      title: "11 이미지 · 참조와 문서 저장",
      text: "replaceNodeImage / PUT document\n\n노드에는 id·width·height·byteLength만 넣는다. 이미지 GET도 소유권을 검사한다.\n\n저장 시 참조와 expectedVersion을 검증한다. Undo를 위해 제거·교체한 파일도 즉시 삭제하지 않는다.\n\n오른쪽은 실제 이미지 노드로 저장한 발표 페이지다.",
    },
  ],
];
