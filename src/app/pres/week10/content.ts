// 10주차 발표: 태그 · 검색 · 연결 강화 · 체크리스트와 역할.

type Workflow = {
  id: string;
  title: string;
  action: string;
  result: string;
  steps: readonly { fn: string; detail: string }[];
  file: string;
  code: string;
};

export const workflows: Workflow[] = [
  {
    id: "tags",
    title: "노드에 태그 붙이기",
    action:
      "노드를 고르고 속성 패널 ‘태그’ 칸에 이름을 쓴 뒤 Enter를 누른다. 노드를 여러 개 고르면 ‘공통 태그’로 한 번에 붙인다.",
    result:
      "같은 이름의 태그가 있으면 그걸 붙이고, 없으면 새 색으로 만든다. 노드 머리에 색 점이 최대 3개, 넘치면 +N으로 보인다.",
    steps: [
      {
        fn: "TagInput → onAdd(name)",
        detail:
          "입력 중에는 이름이 맞는 기존 태그를 8개까지 권한다. 한글 조합을 끝내는 Enter는 태그를 만들지 않는다(isComposing·keyCode 229 무시).",
      },
      {
        fn: "createOrFindTag(root, name)",
        detail:
          "앞의 #과 공백을 정리하고, 대소문자를 무시해 같은 이름을 찾는다. 없으면 가장 덜 쓰인 팔레트 색으로 새 태그를 만든다(프로젝트에 200개까지).",
      },
      {
        fn: "attachTag(root, path, nodeIds, tagId)",
        detail:
          "지금 공간의 노드들에 태그 ID만 붙인다. 이미 20개인 노드는 건너뛰고 몇 개를 못 붙였는지 알려준다. 만들기와 붙이기가 실행 취소 한 단계다.",
      },
      {
        fn: "workspaceDocumentSchema (superRefine)",
        detail:
          "태그 목록은 루트에만 있고, 모든 깊이의 노드가 가진 태그 ID가 목록에 있는지 저장할 때 서버가 확인한다.",
      },
    ],
    file: "src/features/workspace/tags.ts · tag-input.tsx",
    code: `export function createOrFindTag(root, input) {
  const name = normalizeTagName(input);   // "#기획 " → "기획"
  if (!name) return { error: NAME_RULE_ERROR };
  const existing = findTagByName(root, name); // 대소문자 무시
  if (existing) return { document: root, tag: existing };
  if ((root.tags?.length ?? 0) >= MAX_PROJECT_TAGS)
    return { error: "태그는 프로젝트에 200개까지 …" };
  const tag = { id: uuidv4(), name, color: pickTagColor(root) };
  return { document: { ...root, tags: [...(root.tags ?? []), tag] }, tag };
}`,
  },
  {
    id: "tag-peek",
    title: "태그 미리보기와 태그 렌즈",
    action: "노드 머리의 색 점을 클릭하고, 카드에서 ‘디자인’ 태그를 누른다.",
    result:
      "점 아래에 태그 이름 카드가 피어나고, 태그를 누르면 그 태그가 붙은 노드만 또렷하게 남고 나머지는 흐려진다.",
    steps: [
      {
        fn: "TagPeek — onClick / isQuickPress",
        detail:
          "0.35초 안에 짧게 누르면 카드를 연다. 누른 채 끌면 노드를 옮기고, 꾹 눌렀다 떼면 아무것도 열지 않는다.",
      },
      {
        fn: "createPortal(card, document.body)",
        detail:
          "카드는 캔버스 밖 화면 위에 그려서 확대 비율과 상관없이 같은 크기다. 화면 밖으로 나가면 안쪽으로 당기고, 아래가 모자라면 위로 뒤집는다.",
      },
      {
        fn: "openTagLens(tag)",
        detail:
          "검색을 ‘#디자인 ’으로 바로 연다(디바운스 없이). 문서를 바꾸지 않으므로 실행 취소 이력에 남지 않는다.",
      },
    ],
    file: "src/features/workspace/tag-peek.tsx · workspace.tsx",
    code: `/** 짧게 누른 클릭인지. 키보드 클릭은 누른 시간이 없어(null) 연다. */
export function isQuickPress(pressedForMs: number | null) {
  return pressedForMs === null || pressedForMs < 350;
}

function openTagLens(tag: TagDefinition) {
  const query = \`#\${tag.name} \`;   // 끝 공백: 태그 후보 칩을 다시 띄우지 않음
  setSearchOpen(true);
  setSearchQuery(query);
  setDebouncedQuery(query);         // 기다리지 않고 바로 흐림
}`,
  },
  {
    id: "search",
    title: "노드 검색",
    action:
      "Ctrl+F(입력칸 안에서도)나 돋보기로 검색을 열고 ‘버튼’ 또는 ‘#디자인’을 친다.",
    result:
      "결과가 아닌 노드는 흐려지고, 목록을 가리키면 그 노드가 빛난다. 결과를 누르면 하위 캔버스까지 들어가 노드를 가운데 두고 선택한다.",
    steps: [
      {
        fn: "parseSearchQuery(input)",
        detail:
          "띄어쓰기로 나눈 낱말이 모두 있어야 하고(대소문자 무시), #으로 시작하는 낱말은 그 글자로 시작하는 태그만 찾는다.",
      },
      {
        fn: "searchWorkspace(root, query, currentPath)",
        detail:
          "모든 깊이를 훑어 제목·본문·태그·링크·체크리스트 항목을 본다. 지금 캔버스 결과가 먼저, 목록은 100개까지. 흐림·배지는 잘리지 않은 전체 결과로 계산한다.",
      },
      {
        fn: "anchorId / countNestedMatches",
        detail:
          "하위 캔버스 안의 결과는 지금 캔버스의 그 캔버스 노드가 대신 빛나고 ‘N개 찾음’ 배지를 단다.",
      },
      {
        fn: "pickSearchResult → focusNodeById",
        detail:
          "다른 캔버스면 그 경로로 들어간 뒤, 카메라 복원이 끝난 다음 노드를 화면 가운데 두고 선택한다.",
      },
    ],
    file: "src/features/workspace/search.ts · search-panel.tsx",
    code: `const matches =
  query.words.every((word) => haystack.includes(word)) &&
  query.tagPrefixes.every((prefix) =>
    names.some((name) => name.startsWith(prefix)),
  );

// 지금 캔버스 결과 먼저, 그다음 얕은 순
found.sort((a, b) => inCurrent(a) - inCurrent(b)
                  || a.path.length - b.path.length);
return {
  results: found.slice(0, 100),  // 목록
  matches: found,                // 흐림·배지 계산
  total: found.length,
};`,
  },
  {
    id: "multi-connect",
    title: "여러 노드 한꺼번에 연결",
    action:
      "노드 세 개를 범위 선택한 채 그중 하나의 오른쪽 연결점을 끌어 다른 노드의 왼쪽 점에 놓는다.",
    result:
      "고른 노드 모두에서 같은 변으로 미리보기 선이 따라 나오고, 놓으면 한 번에 세 줄이 이어진다. 실행 취소 한 번이면 모두 되돌아간다.",
    steps: [
      {
        fn: "startNodeConnection",
        detail:
          "잡은 노드가 다중 선택 안에 있으면 선택을 유지하고, 나머지 노드도 잡은 점과 같은 변을 출발점(others)으로 둔다.",
      },
      {
        fn: "connectSourcesToTarget",
        detail:
          "대상 노드 자신, 이미 있는 연결, 사라진 노드는 조용히 건너뛰고, 캔버스당 3000개 한도를 넘는 몫만 세어 알린다.",
      },
    ],
    file: "src/features/workspace/connections.ts",
    code: `for (const source of sources) {
  if (source.nodeId === target.nodeId) continue;   // 자기 자신
  const key = getConnectionKey({ source, target });
  if (keys.has(key)) continue;                      // 이미 있는 선
  if (connections.length + added.length >= limit) {
    skippedForLimit++;                              // 한도 초과
    continue;
  }
  keys.add(key);
  added.push({ id: makeId(), source, target });
}`,
  },
  {
    id: "drop-new-node",
    title: "빈 곳에 놓아 이어서 만들기",
    action:
      "연결점에서 선을 끌어 빈 곳에 놓고, 뜬 메뉴에서 텍스트(T)를 고른다.",
    result:
      "놓은 자리에 새 노드가 생기고 선이 이어진 채 선택된다. 오른쪽에 놓으면 새 노드의 왼쪽 점, 왼쪽에 놓으면 오른쪽 점에 잇는다.",
    steps: [
      {
        fn: "endGesture → setConnectMenu",
        detail:
          "연결점·노드가 아닌 빈 곳이고 8px 이상 끌었으면 그 자리에 노드 종류 메뉴를 띄우고, 놓은 자리까지 점선을 남긴다.",
      },
      {
        fn: "facingSide(from, to)",
        detail:
          "가로·세로 중 더 멀리 끈 쪽으로 새 노드가 출발점을 바라보는 변을 정한다(같으면 가로).",
      },
      {
        fn: "positionForPort → appendConnectedNode",
        detail:
          "그 변의 연결점이 놓은 자리에 오도록 노드를 놓고, 노드와 선을 한 번의 문서 변경(실행 취소 한 단계)으로 넣는다.",
      },
    ],
    file: "src/features/workspace/connections.ts · connect-node-menu.tsx",
    code: `export function facingSide(from: Point, to: Point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "left" : "right";
  return dy >= 0 ? "top" : "bottom";
}

export function positionForPort(anchor, side, width, height) {
  if (side === "left")  return { x: anchor.x,         y: anchor.y - height / 2 };
  if (side === "right") return { x: anchor.x - width, y: anchor.y - height / 2 };
  if (side === "top")   return { x: anchor.x - width / 2, y: anchor.y };
  return                       { x: anchor.x - width / 2, y: anchor.y - height };
}`,
  },
  {
    id: "checklist",
    title: "체크리스트 노드와 할 일 역할",
    action:
      "노드의 역할을 ‘할 일’로 정하고 체크리스트 노드에 연결한다. 체크리스트 안에도 ‘우유 사기’를 직접 쓴다.",
    result:
      "체크리스트에 연결된 할 일과 직접 쓴 항목이 함께 나오고 ‘1 / 3 완료 · 33%’로 진행률을 보여준다. 목록 체크와 노드의 체크 버튼은 같은 상태다.",
    steps: [
      {
        fn: 'NodeBase.role = { kind: "todo", done }',
        detail:
          "체크 상태는 할 일 노드에 저장한다. 같은 할 일을 체크리스트 두 곳에 이어도 상태는 하나라 어긋나지 않는다.",
      },
      {
        fn: "buildChecklist(document, checklistId)",
        detail:
          "목록은 저장하지 않고 그릴 때마다 연결선으로 계산한다. 연결된 할 일(위치 순, 선이 여러 개여도 한 번) 다음에 직접 항목.",
      },
      {
        fn: "roleForConnectedNode",
        detail:
          "체크리스트에서 ‘이어서 만들기’로 만든 노드는 자동으로 할 일이 된다. 역할 없는 노드를 이으면 ‘할 일로 만들기’ 안내가 뜬다.",
      },
      {
        fn: "add/edit/removeChecklistItem",
        detail:
          "직접 항목은 앞뒤 공백을 빼고 200자까지, 체크리스트당 200개. 글을 비우고 적용하면 항목이 지워진다.",
      },
    ],
    file: "src/features/workspace/checklist.ts · roles.ts",
    code: `const linkedIds = new Set<string>();
for (const connection of document.connections) {
  if (connection.source.nodeId === checklistId)
    linkedIds.add(connection.target.nodeId);
  else if (connection.target.nodeId === checklistId)
    linkedIds.add(connection.source.nodeId);     // 선 여러 개여도 한 번
}
for (const node of linked.sort(byPosition)) {
  if (node.role?.kind === "todo")
    entries.push({ kind: "node", node, done: node.role.done });
  else if (canHaveRole(node)) unassignedNodeIds.push(node.id);
}
for (const item of checklist.items) entries.push({ kind: "item", item });`,
  },
];

export const polish = [
  {
    title: "화면이 그대로",
    detail:
      "속성 패널을 열고 닫아도, 창 크기를 바꿔도 화면 맞춤을 다시 하지 않는다. 처음 그려질 때만 맞춘다.",
  },
  {
    title: "화면 맞춤 버튼",
    detail: "캔버스 왼쪽 아래 아이콘 버튼. 단축키 0과 같다.",
  },
  {
    title: "원본 크기 버튼",
    detail:
      "이미지 크게 보기에서 지금 배율(‘지금 32%’)을 보여주고, 이미 원본 크기인 작은 이미지에서는 막힌다.",
  },
  {
    title: "우클릭·글자 선택",
    detail:
      "작업 영역에서 브라우저 우클릭 메뉴를 막고, 버튼·안내 글자는 드래그해도 선택되지 않는다. 글 쓰는 칸은 그대로.",
  },
  {
    title: "펜·지우개 다듬기",
    detail:
      "그리는 동안 노드를 건드리지 않고, 지우개는 동그란 커서로 지울 범위를 보여준다.",
  },
];

export const storage = [
  {
    label: "태그 목록",
    location: "project.document → tags[] (루트에만)",
    detail:
      "{ id, name, color }. 이름·색을 바꾸면 모든 캔버스에 함께 반영된다. 비면 필드를 저장하지 않는다.",
  },
  {
    label: "노드의 태그",
    location: "nodes[].tags (태그 ID 목록)",
    detail: "노드당 20개까지. 태그를 지우면 모든 깊이의 노드에서 ID가 빠진다.",
  },
  {
    label: "역할",
    location: 'nodes[].role = { kind: "todo", done }',
    detail:
      "체크 상태는 할 일 노드에. 체크리스트 노드에는 붙지 않는다(스키마가 거절).",
  },
  {
    label: "체크리스트 항목",
    location: "checklist_node.items[] = { id, text, done }",
    detail:
      "직접 쓴 항목만 저장한다. 연결된 할 일 목록은 저장하지 않고 그릴 때 연결선으로 계산한다.",
  },
  {
    label: "검색·흐림·미리보기 카드",
    location: "저장하지 않음 (화면 상태)",
    detail: "문서를 바꾸지 않으므로 실행 취소 이력에도, 저장에도 남지 않는다.",
  },
];
