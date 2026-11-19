# 노드 복사·잘라내기·붙여넣기와 상황별 우클릭 메뉴 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 노드(와 통째로 고른 그룹)를 앱 안 클립보드로 복사·잘라내기·붙여넣기 하고, 작업영역 어디서든 상황에 맞는 우클릭 메뉴를 띄운다.

**Architecture:** 복사 묶음 만들기와 붙여넣기는 순수 함수(`node-clipboard.ts`)로 두고 스키마·한도를 거기서 지킨다. `workspace.tsx`는 앱 클립보드 ref와 마지막 포인터 위치 ref를 들고 copy/cut/paste 이벤트와 메뉴를 연결한다. 그룹 선택은 따로 상태 없이 "멤버 전부 선택"에서 파생한다.

**Tech Stack:** Next.js 16 / React 19 (React Compiler) / TypeScript / zod 4 / Tailwind 4 / node:test + tsx

**Spec:** `docs/superpowers/specs/2026-11-18-node-clipboard-design.md`

## Global Constraints

- 클립보드는 앱 안(같은 탭)만. 시스템 클립보드에는 글만 쓴다.
- 그룹 선택 = 멤버가 1개 이상이고 멤버 전부가 선택된 그룹(1명짜리 그룹 포함).
- 붙여넣기: 묶음 경계 상자 가운데를 기준점에. 메뉴는 우클릭 자리, Ctrl+V는 마지막 포인터 자리(뷰포트 밖이면 화면 가운데). 유한 캔버스면 묶음째 안으로 민다.
- 통째 그룹은 새 ID·같은 이름의 새 그룹. 낱개 노드는 기준점이 그룹 영역 안이면 그 그룹에 들어간다. 일부만 고른 그룹 멤버는 `groupId` 없이.
- 붙여넣기·잘라내기는 실행 취소 한 단계.
- 문구(그대로): `그룹은 공간마다 200개까지 만들 수 있어요.` · `노드는 프로젝트 전체에서 ${MAX_WORKSPACE_NODES}개까지 만들 수 있어요.` · 그림 한도는 기존 `DRAWING_LIMIT_NOTICE` · 깊이 `작업 공간은 ${MAX_CANVAS_DEPTH}단계까지 넣을 수 있어요.` · 글자 붙여넣기 실패 `붙여넣기는 Ctrl+V를 써 주세요.`
- 글 칸 규칙(A): Ctrl+C/X는 노드 안 글 칸에서 고른 글자가 없으면 노드용, 있으면 글자. 노드 밖 글 칸은 늘 글자. Ctrl+V는 글 칸에 포커스가 있으면 늘 글자.
- 메뉴 순서: 잘라내기(Ctrl+X) · 복사(Ctrl+C) · 붙여넣기(Ctrl+V) · 구분선 · 그룹화(G) · 그룹화 해제(Shift+G, 그룹 멤버가 있을 때만). 앱 클립보드가 비면 붙여넣기 disabled.
- 사용자에게 보이는 글은 한국어. 사용자 글이 아닌 크롬 글자는 드래그 선택 불가(`chrome-no-select` 안).
- 검사: `node node_modules/typescript/bin/tsc --noEmit`, `npx eslint src scripts`, 바꾼 파일만 prettier.
- 테스트 명령(전체): `node --import tsx --test scripts/test-node-clipboard.ts scripts/test-node-groups.ts scripts/test-workspace-editing.ts`

## Review Focus

1. 복사 후 다른 곳에서 주소를 복사하고 Ctrl+V → 링크 노드가 생겨야 함(옛 노드 아님). → Task 3 테스트.
2. 하위 캔버스 노드를 깊은 공간에 붙여넣기 → 깊이 한도 넘으면 거절, 저장 실패 없음. → Task 1 테스트.
3. 붙여넣은 묶음 안 연결선·하위 캔버스 안 노드·그룹 모두 새 ID(원본과 겹치지 않음) → 두 번 붙여넣어도 스키마 통과. → Task 1 테스트.
4. 텍스트 노드 본문에 커서만 있을 때 Ctrl+C → 노드 복사, 글자를 골랐을 때 → 글자 복사(노드 클립보드 그대로). → Task 3 테스트.
5. 잘라내기 후 실행 취소 → 노드·그룹 복원, 앱 클립보드는 남음. → Task 3 테스트.

---

### Task 1: 복사 묶음과 붙여넣기 순수 함수

**Files:**
- Create: `src/features/workspace/node-clipboard.ts`
- Modify: `src/features/workspace/node-clone.ts` (복제 도우미 export만)
- Test: `scripts/test-node-clipboard.ts`

**Interfaces:**
- Consumes: `groupAtPoint`, `MAX_GROUPS_PER_CANVAS` (groups.ts), `cloneNode`/`remapConnections` 로직(node-clone.ts — export해서 재사용), `updateWorkspaceAtPath`, `walkWorkspaceNodes`, `MAX_CANVAS_DEPTH`, `MAX_WORKSPACE_NODES` (workspace-tree.ts), `countDocumentDrawingPoints`, `countNodesDrawingPoints`, `MAX_DRAWING_POINTS` (drawing.ts), `MAX_CONNECTIONS` (connections.ts).
- Produces:
  - `type NodeClip = { nodes: WorkspaceNode[]; connections: NodeConnection[]; groups: NodeGroup[]; text: string; systemSynced: boolean }`
  - `selectedGroupIds(document: WorkspaceDocument, selectedIds: readonly string[]): string[]`
  - `makeClip(document: WorkspaceDocument, nodeIds: readonly string[]): NodeClip | null` — 고른 노드 없으면 null. `systemSynced`는 true로 시작.
  - `pasteClip(root: WorkspaceDocument, path: string[], clip: NodeClip, point: Point): { document: WorkspaceDocument; nodeIds: string[] } | { error: "nodes" | "drawing" | "groups" | "depth" }`

- [ ] **Step 1: 실패하는 테스트 작성** (`scripts/test-node-clipboard.ts`, test-node-groups.ts의 `textNode`/`docWith` 방식 재사용)

```ts
test("selectedGroupIds needs every member, single-member groups count", ...)
  // g: a,b / h: d(혼자) → selectedGroupIds(doc,[a]) = [] ; [a,b] = [g] ; [d] = [h] ; [a,b,d,c] = [g,h]
test("makeClip keeps whole groups and drops partial group ids", ...)
  // makeClip(doc,[a,b,c]) → groups=[{id:g,title:"가"}], a/b groupId g, c 없음
  // makeClip(doc,[a]) → groups=[], a에 groupId 없음 ("groupId" in node === false)
test("makeClip copies only connections inside the selection", ...)
test("makeClip text joins titles and texts top-to-bottom, falls back to 노드 N개", ...)
  // 빈 제목·본문 노드 2개 → "노드 2개"
test("makeClip returns null when nothing matches", ...)
test("pasteClip centers the clip on the point and selects new ids", ...)
  // a(100,100,200x100), b(400,300,200x100) 경계 가운데 (350,250) → point (1000,1000)이면 a가 (750,850)
  // nodeIds.length === 2, 원본 id와 겹치지 않음
test("pasteClip pushes the clip inside a finite canvas", ...)
  // canvas 2000x1200, point (1990,1190) → 모든 노드가 0..width/height 안
test("pasteClip makes a new group with the same title for whole groups", ...)
  // 붙인 뒤 groups 수 +1, 새 그룹 title "가", 새 노드 groupId = 새 그룹 id ≠ g
test("pasteClip loose nodes join the group under the point, whole groups do not", ...)
  // 낱개 c를 g 영역 안 점에 → 새 노드 groupId g
  // 통째 g 묶음을 h 영역 안 점에 → 새 그룹, h에 안 들어감
test("pasteClip twice gives fresh ids everywhere and passes the schema", ...)
  // 하위 canvas_node(안에 노드 2개+연결선 1개) 포함 묶음을 두 번 붙임 → workspaceDocumentSchema.safeParse 성공
test("pasteClip refuses past the node, group and depth limits", ...)
  // 노드 1000개 근처 → {error:"nodes"}; 그룹 200개 + 통째 그룹 묶음 → {error:"groups"}
  // 깊이 7 공간(path 길이 7)에 하위 캔버스 노드(안에 캔버스 노드 하나 더) → {error:"depth"}
test("pasteClip into a sub canvas", ...)
  // path=[canvasNodeId] 로 붙이면 하위 문서에만 추가, 루트 nodes 그대로
```

- [ ] **Step 2: 실행해 실패 확인**

Run: `node --import tsx --test scripts/test-node-clipboard.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: `node-clipboard.ts` 구현**

- 깊이 확인: 붙일 공간 깊이 = `path.length`. 묶음 안 캔버스 노드가 만드는 추가 깊이(캔버스 노드 1단계 = 1, 안에 또 있으면 +1…)를 더해 `MAX_CANVAS_DEPTH` 초과면 `depth`. 스키마의 깊이 정의(`workspace-schema.ts` `documentSchemaAtDepth`)와 같은 기준으로 셀 것 — 테스트로 경계 확인.
- 노드 한도: `[...walkWorkspaceNodes(root)].length + countNodes(clip.nodes) > MAX_WORKSPACE_NODES`.
- 그림: `countDocumentDrawingPoints(root) + countNodesDrawingPoints(clip.nodes) > MAX_DRAWING_POINTS` → `drawing`.
- 그룹: 대상 공간 그룹 수 + `clip.groups.length > MAX_GROUPS_PER_CANVAS` → `groups`.
- 가입 판단은 붙이기 **전** 대상 공간 문서로 `groupAtPoint(current, point)`.
- 연결선은 `slice(0, MAX_CONNECTIONS)` (복제와 같음).
- 클립 안 노드는 깊은 복사로 저장(원본이 바뀌어도 클립 그대로).

- [ ] **Step 4: 통과 확인**

Run: `node --import tsx --test scripts/test-node-clipboard.ts scripts/test-node-groups.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/workspace/node-clipboard.ts src/features/workspace/node-clone.ts scripts/test-node-clipboard.ts
git commit -m "Build copy clips and paste them with fresh ids, groups and limits"
```

### Task 2: 그룹 선택 표시와 Shift+탭 토글

**Files:**
- Modify: `src/features/workspace/group-layer.tsx`, `src/features/workspace/node-frame.tsx`, `src/features/workspace/workspace.tsx` (`startGroupDrag`, 렌더)
- Test: `scripts/test-workspace-editing.ts`

**Interfaces:**
- Consumes: `selectedGroupIds` (Task 1).
- Produces: `GroupLayer` prop `selectedGroupIds: string[]`; `NodeFrame` prop `showSelection?: boolean` (기본 = `selected`). `selected`는 접근성 이름("선택됨")과 zIndex에 그대로 쓴다.

- [ ] **Step 1: 실패하는 테스트**

```ts
test("Shift+tab click adds a group to the selection and removes it when already selected", () => {
  const h = groupedSetup(); h.state.selected = ["c"];
  h.call("startGroupDrag", pointer({ shiftKey: true }), "g");
  assert.deepEqual([...h.state.selected].sort(), ["a", "b", "c"]);
  h.call("endGesture", pointer({ type: "pointerup", buttons: 0 }));
  h.call("startGroupDrag", pointer({ shiftKey: true }), "g");
  assert.deepEqual(h.state.selected, ["c"]);
});
test("plain tab click still replaces the selection with the group", ...)
```

- [ ] **Step 2: 실패 확인** — Run: `node --import tsx --test scripts/test-workspace-editing.ts` Expected: 새 테스트 FAIL

- [ ] **Step 3: 구현**
- `startGroupDrag`: Shift이고 그 그룹이 이미 선택돼 있으면 멤버를 선택에서 빼고 끌기는 시작하지 않는다. Shift이고 아니면 기존 선택 ∪ 멤버로 끌기 시작(`beginNodeGesture(event, union nodes)`). Shift 아니면 지금처럼.
- 렌더: `const groupSelection = selectedGroupIds(workspace, selectedNodeIds)`; 그 그룹 멤버 노드는 `showSelection={false}`.
- `GroupLayer`: 선택된 그룹 영역 `border-2 border-moss-deep`(배경은 지금 `bg-moss/10` 유지), 탭 `border-moss-deep bg-moss/30 text-bark`. 끌어 넣기 대상(`joinTargetId`) 표시가 우선.

- [ ] **Step 4: 통과 확인** — 같은 명령, Expected: PASS

- [ ] **Step 5: Commit** — `git commit -m "Show a fully selected group as the group itself and toggle groups with Shift on the tab"`

### Task 3: 복사·잘라내기·붙여넣기 연결 (키와 함수)

**Files:**
- Modify: `src/features/workspace/workspace.tsx`, `src/features/workspace/keyboard-targets.ts`
- Test: `scripts/test-workspace-editing.ts`, (keyboard-targets 테스트 파일이 있으면 거기, 없으면 test-workspace-editing.ts)

**Interfaces:**
- Consumes: `makeClip`, `pasteClip`, `NodeClip` (Task 1).
- Produces (workspace.tsx 안 함수, 하네스 names에 추가):
  - `clipboardRef: { current: NodeClip | null }`, `lastPointerRef: { current: { clientX: number; clientY: number } | null }` (뷰포트 `onPointerMove`에서 갱신, `onPointerLeave`에서 null)
  - `copySelection(): NodeClip | null` — 선택 없거나 제스처 중이면 null, 아니면 `clipboardRef`에 저장 후 반환
  - `cutSelection(): void` — `copySelection()` 후 `deleteSelection()`
  - `pasteAt(point: Point): void` — 클립 없거나 제스처 중이면 무시. 오류는 `setNotice`로 해당 문구. 성공하면 commit+change 한 단계, 선택 = 새 nodeIds, 연결선 선택 해제, 뷰포트 포커스.
  - `pastePoint(): Point` — `lastPointerRef` 있으면 그 캔버스 좌표(`getCanvasPoint`), 없으면 화면 가운데 캔버스 좌표.
  - `handleCopy(event)`, `handleCut(event)` — `<main>`의 `onCopy`/`onCut`. `copiesNodes(event.target)`가 false거나 선택이 없으면 아무것도 안 함. 아니면 `clipboardData.setData("text/plain", clip.text)`, `preventDefault()`.
  - `handlePaste` 확장: 이미지 파일 → 지금처럼. 그다음 `clip && (text === clip.text || !clip.systemSynced)` → `pasteAt(pastePoint())`. 아니면 지금처럼(주소 → 링크).
  - keyboard-targets.ts: `copiesNodes(target: EventTarget | null): boolean` — 글 칸(input/textarea/contenteditable)이 아니면 true. 글 칸이 `[data-node-id]` 안이고 고른 글자가 없으면(input/textarea `selectionStart === selectionEnd`, contenteditable은 `getSelection()?.isCollapsed`) true. 그 밖은 false.
- 브라우저가 고른 글자 없는 textarea에서 copy 이벤트를 안 보내면 `handleEditorShortcut`에서 Ctrl+C/X를 같은 규칙으로 처리(이 경우 시스템 클립보드 쓰기는 `navigator.clipboard.writeText` 시도, 실패면 `systemSynced=false`). 브라우저 확인으로 결정하고 ledger에 Ruling.

- [ ] **Step 1: 실패하는 테스트** (하네스에 `clipboardRef`, `lastPointerRef`, `navigator` 스텁을 state로 주입)

```ts
test("Ctrl+C on the canvas copies the selection and writes its text", ...)
  // setup(["a"]); handleCopy(event{target:new TestElement(), clipboardData 스텁}) → state.clip.nodes[0].title==="A", setData("text/plain","A\n\n본문"), defaultPrevented
test("copy in a node text field with selected text leaves it to the browser", ...)
  // target: 노드 안 글 칸, selectionStart 0, selectionEnd 2 → clip 없음, defaultPrevented false
test("copy in a node text field with only a caret copies the node", ...)
test("copy in a text field outside nodes never copies nodes", ...)
test("cut copies then deletes in one undo step and undo keeps the clip", ...)
  // past.length 1, undo 뒤 a 복원, state.clip 그대로
test("paste of the same text pastes nodes at the last pointer, one undo step", ...)
  // lastPointer clientX 510, clientY 370 → 캔버스 (1000,700); 붙인 묶음 가운데가 (1000,700)
  // selected = 새 id들, past.length +1
test("paste with different text falls back to the link node path", ...)
  // clip 있음, clipboard text "https://example.com" → calls에 "add:link_node"
test("paste after a failed system write still pastes nodes", ...)  // systemSynced false
test("paste without a pointer uses the view center", ...)
test("paste over the node limit shows the notice and changes nothing", ...)
```

- [ ] **Step 2: 실패 확인** — Run: `node --import tsx --test scripts/test-workspace-editing.ts` Expected: 새 테스트 FAIL

- [ ] **Step 3: 구현** (위 Interfaces 그대로)

- [ ] **Step 4: 통과 확인** — 전체 테스트 명령, Expected: PASS. tsc, eslint 깨끗.

- [ ] **Step 5: Commit** — `git commit -m "Copy, cut and paste nodes with Ctrl+C, X and V"`

### Task 4: 상황별 우클릭 메뉴, 글자 메뉴, 도움말·문서, 브라우저 확인

**Files:**
- Modify: `src/features/workspace/node-context-menu.tsx` (일반 메뉴로), `src/features/workspace/workspace.tsx`, `src/features/workspace/shortcut-help.tsx`, `docs/workspace-groups.md` (그룹 선택·붙여넣기 줄), `DESIGN.md`(메뉴 항목이 있으면)
- Test: `scripts/test-workspace-editing.ts`

**Interfaces:**
- Consumes: Task 3 함수들, `groupSelection`, `ungroupSelection`.
- Produces:
  - `NodeContextMenu` props: `{ left, top, label: string, items: ContextMenuEntry[], onClose }`, `type ContextMenuEntry = { id: string; label: string; shortcut?: string; disabled?: boolean; onSelect: () => void } | "separator"`. disabled 항목은 화살표 이동에서 건너뛴다.
  - 상태 `contextMenu: { left: number; top: number; point: Point; kind: "nodes" | "paste" | "text"; field?: { element: HTMLInputElement | HTMLTextAreaElement; start: number; end: number } } | null` (기존 `nodeMenu` 대체, 하네스 스텁 `setContextMenu`)
  - `openContextMenuAt(event)` (기존 `openNodeMenuAt` 대체, 바깥 래퍼 `onContextMenu`에서 부르고 항상 `preventDefault`):
    1. 선택 도구 아님/제스처 중 → 아무 메뉴 없음.
    2. 글 칸 + 고른 글자 있음 → `kind:"text"`, field 범위 기억.
    3. 글 칸 + 고른 글자 없음: 노드 안이면 4로, 아니면 메뉴 없음.
    4. `[data-node-id]` 안 → 선택에 없으면 그 노드만 선택 → `nodes`.
    5. `[data-group-id]` 안(이름 탭) → 그 그룹이 선택돼 있지 않으면 멤버로 선택 교체 → `nodes`.
    6. 빈 곳 → 노드 선택이 있으면 `nodes`(선택 유지), 없으면 `paste`.
    - `point` = 우클릭 자리 캔버스 좌표.
  - `contextMenuItems(menu): ContextMenuEntry[]` — kind별 항목(Global Constraints 순서). `nodes`의 붙여넣기는 `pasteAt(menu.point)`, `paste`도 같음. `text`는 글자 잘라내기·복사·붙여넣기.
  - 글자 동작: 복사 = `navigator.clipboard.writeText(선택 글)`. 잘라내기 = 복사 후 칸 포커스·`setSelectionRange(start,end)`·`document.execCommand("delete")`. 붙여넣기 = `navigator.clipboard.readText()` → 칸 포커스·범위 복원·`execCommand("insertText", false, text)`; 실패 시 `setNotice("붙여넣기는 Ctrl+V를 써 주세요.")`. 메뉴 닫힐 때 칸으로 포커스.
  - 메뉴 키 / Shift+F10: 선택 있으면 지금처럼, 없으면 화면 가운데 `paste` 메뉴.
  - 단축키 표시 글: Mac(`navigator.platform`/`userAgent`에 Mac)이면 `⌘X` 꼴, 아니면 `Ctrl+X`. G, Shift+G는 그대로.
  - shortcut-help: `["Ctrl + C / X / V", "노드 복사 / 잘라내기 / 붙여넣기"]` 추가, `["우클릭 · 메뉴 키", "상황별 메뉴"]`로 바꿈.

- [ ] **Step 1: 실패하는 테스트**

```ts
test("right-click on a node opens the node menu with cut, copy, paste and group", ...)
  // contextMenuItems 라벨 = ["잘라내기","복사","붙여넣기","separator","그룹화"], 클립 없으면 붙여넣기 disabled
test("right-click on a grouped selection adds ungroup", ...)
test("right-click on empty space keeps the selection and opens the node menu", ...)
test("right-click on empty space with nothing selected offers paste only", ...)
test("right-click on a group tab selects the group", ...)
test("right-click in a field with selected text opens the text menu", ...)
test("right-click in a node field with only a caret opens the node menu", ...)
test("right-click in an outside field without selected text opens nothing", ...)
test("menu paste puts the clip at the right-click point", ...)
test("menu key with nothing selected opens paste at the view center", ...)
test("no menu while drawing or during a gesture", ...)
```

- [ ] **Step 2: 실패 확인** — `node --import tsx --test scripts/test-workspace-editing.ts`, Expected: 새 테스트 FAIL

- [ ] **Step 3: 구현**, 기존 우클릭·메뉴 키 테스트는 새 이름(`openContextMenuAt`, `state.contextMenu`)으로 고친다.

- [ ] **Step 4: 통과 확인** — 전체 테스트 명령 PASS, tsc·eslint 깨끗, prettier.

- [ ] **Step 5: 브라우저 확인** (dev 3001, 시드 계정 `ui-check-cb@example.com`, 끝나면 정리 스크립트로 삭제)
  - 그룹 탭 클릭 → 그룹 테두리만 진하고 멤버 노드 테두리 없음; Shift+탭으로 두 번째 그룹 추가.
  - 노드 복사 → 다른 그룹 영역 위에 마우스 두고 Ctrl+V → 그 그룹에 들어감. 그룹 통째 복사·붙여넣기 → 같은 이름 새 그룹.
  - 텍스트 노드 본문 커서만 → Ctrl+C가 노드 복사; 글자 드래그 → 글자 복사, 우클릭 글자 메뉴.
  - 빈 곳 우클릭(선택 없음/있음), 하위 캔버스에 붙여넣기, 새로고침 후 저장 확인.
  - 고른 글자 없는 textarea에서 copy 이벤트가 오는지 확인(Task 3 Ruling 근거).

- [ ] **Step 6: Commit** — `git commit -m "Open a context menu by situation anywhere in the workspace"`
