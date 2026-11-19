# 노드 그룹 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고른 노드를 G/우클릭으로 묶고, 묶인 노드를 감싸는 반투명 영역과 이름 탭을 그리며, 끌어서 들어가기·탭으로 그룹 이동·그룹화 해제를 지원한다.

**Architecture:** 노드는 `groupId`만, 공간은 `groups: {id, title}[]`만 저장한다. 영역은 순수 함수(`groupBounds`)로 그릴 때 계산한다. 탭 끌기는 기존 노드 끌기 제스처(`kind: "node"`, `startPositions`)에 멤버를 넣어 재사용한다. 모든 문서 변경은 commit → change(또는 끌기 트랜잭션) 한 단계.

**Tech Stack:** Next.js 16 / React 19 (React Compiler) / TypeScript / zod 4 / Tailwind 4, 테스트 `node --import tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-18-node-groups-design.md`

## Global Constraints

- 그룹 이름: 앞뒤 공백 제거 후 1–40자, 기본·빈 값은 "그룹". 공간당 그룹 200개(넘으면 알림 "그룹은 공간마다 200개까지 만들 수 있어요."). 영역 여유 32px(캔버스 단위).
- 노드는 한 그룹에만, 중첩 없음. 멤버 없는 그룹은 스키마가 허용하고, 편집 함수가 정리하며, 화면은 그리지 않는다.
- 단축키: G 그룹화, Shift+G 그룹화 해제, 메뉴 키·Shift+F10 우클릭 메뉴. 메뉴 문구 "그룹화", "그룹화 해제".
- 그룹은 손그림 위, 연결선·노드 아래. 그리기 도구가 켜져 있으면 입력을 받지 않는다.
- 색·그림자는 `globals.css` 토큰만. 크롬 글자는 `chrome-no-select` 안에 있다. 키보드 컨트롤은 `data-keyboard-control`.
- 검사: `node node_modules/typescript/bin/tsc --noEmit`, `npx eslint src scripts`, 단위 테스트(auth-projects·integration 제외), 바꾼 파일 prettier.

## Review Focus

1. **멤버를 지우는 모든 경로(삭제·잘라내기·공간 이동 중 Undo)에서 빈 그룹이 남아도 저장이 거절되지 않는다.** → Task 1 `schema allows empty groups`.
2. **그룹 멤버와 그룹 없는 노드를 함께 끌어 다른 그룹 위에 놓음:** 아무 그룹에도 들어가지 않는다. → Task 2 `canJoinByDrag false when any dragged node is grouped`.
3. **하위 캔버스 노드가 다른 공간(루트)의 그룹 ID를 가짐(복사·붙여넣기 등):** 스키마가 거절해야 하고, 편집 함수는 그런 상태를 만들지 않는다. → Task 1 `schema rejects groupId from another canvas`.
4. **그룹이 겹친 곳에 놓음:** 나중에 만든(목록 뒤쪽) 그룹으로 들어간다. → Task 2 `groupAtPoint prefers the later group`.
5. **유한 캔버스 가장자리에서 탭으로 그룹 이동:** 멤버 간격을 유지한 채 범위 안에 멈춘다(기존 노드 끌기 제한 재사용). → Task 3 브라우저 확인 + 하네스 테스트.

---

### Task 1: 타입과 스키마

**Files:** Modify `src/features/workspace/types.ts`, `workspace-schema.ts`; Create `src/features/workspace/groups.ts`(상수만), `scripts/test-node-groups.ts`

**Interfaces — Produces:** `type NodeGroup = { id: string; title: string }`, `NodeBase.groupId?: string`, `WorkspaceDocument.groups?: NodeGroup[]`; `groups.ts`의 `MAX_GROUPS_PER_CANVAS = 200`, `MAX_GROUP_TITLE_LENGTH = 40`, `DEFAULT_GROUP_TITLE = "그룹"`, `GROUP_PADDING = 32`.

- [ ] **Step 1: Failing tests** (`scripts/test-node-groups.ts`):
  - `schema accepts groups and member groupId` — 그룹 하나, 노드 둘이 그 ID.
  - `schema allows empty groups` — 멤버 없는 그룹 → 통과.
  - `schema rejects unknown groupId` / `schema rejects duplicate group ids` / `schema rejects title over 40 or blank` (`"   "`, 41자).
  - `schema rejects groupId from another canvas` — 루트 그룹 ID를 하위 캔버스 노드가 가짐 → 거절.
  - `schema rejects 201 groups`, `old documents still parse`.
- [ ] **Step 2: Run** `node --import tsx --test scripts/test-node-groups.ts` → FAIL.
- [ ] **Step 3: Implement** 타입. 스키마: `nodeBaseSchema`에 `groupId: z.uuid().optional()`, 각 깊이 문서에 `groups: z.array(z.strictObject({ id: z.uuid(), title: z.string().max(40).refine(v => v.trim().length > 0 && v === v.trim()) })).max(200).optional()`, 그리고 각 깊이 문서 단위 `superRefine`으로 그룹 ID 유일·노드 `groupId`가 같은 문서 `groups`에 있는지 확인.
- [ ] **Step 4: Run** → PASS, `tsc`.
- [ ] **Step 5: Commit** `git commit -m "Add node groups to the document schema"`

### Task 2: 그룹 순수 함수

**Files:** Modify `src/features/workspace/groups.ts`; Test `scripts/test-node-groups.ts`

**Interfaces — Produces (`groups.ts`):**

- `type Rect = { x: number; y: number; width: number; height: number }`
- `groupBounds(document: WorkspaceDocument, groupId: string): Rect | null` — 멤버 합집합 + 사방 32.
- `visibleGroups(document): { group: NodeGroup; bounds: Rect }[]` — 멤버 있는 그룹만, 목록 순서.
- `groupAtPoint(document, point: Point): string | null` — 영역(탭 제외)에 점이 든 그룹 중 목록 뒤쪽.
- `canJoinByDrag(nodes: readonly WorkspaceNode[]): boolean` — 모두 `groupId` 없을 때만 true(빈 배열 false).
- `groupNodes(root, path, nodeIds, makeId): { document; groupId } | { error: string }` — 새 그룹(이름 "그룹") 추가, 노드 `groupId` 교체, 빈 그룹 정리. 200개면 에러 문구(Global Constraints).
- `ungroupNodes(root, path, nodeIds): WorkspaceDocument` — `groupId` 필드 삭제, 빈 그룹 정리, 바뀐 게 없으면 같은 문서.
- `joinGroup(root, path, nodeIds, groupId): WorkspaceDocument` — 그룹 없는 노드만 넣는다. 그룹이 없으면 그대로.
- `renameGroup(root, path, groupId, title): WorkspaceDocument` — trim·40자 자름, 빈 값이면 "그룹".
- `pruneEmptyGroups(document): WorkspaceDocument` — 빈 그룹 제거, 목록이 비면 `groups` 필드 삭제.

- [ ] **Step 1: Failing tests:** `groupBounds adds 32 padding around members`, `groupBounds is null without members`, `visibleGroups skips empty`, `groupAtPoint prefers the later group`, `groupAtPoint ignores points outside`, `canJoinByDrag false when any dragged node is grouped`(혼합·전부 그룹·빈 배열), `groupNodes moves nodes from other group and prunes the emptied one`, `groupNodes refuses the 201st group`, `ungroupNodes removes field and prunes`, `joinGroup only takes ungrouped nodes`, `renameGroup trims and falls back to 그룹`. 각 결과 문서 `workspaceDocumentSchema` 통과 확인.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git commit -m "Add group operations"`

### Task 3: 그룹 영역·이름 탭 그리기와 탭 동작

**Files:** Create `src/features/workspace/group-layer.tsx`; Modify `workspace.tsx`, `scripts/test-workspace-editing.ts`

**Interfaces:**

- Consumes: `visibleGroups`, `renameGroup`.
- Produces: `GroupLayer` props `{ document: WorkspaceDocument; zoom: number; joinTargetId: string | null; interactive: boolean; onTabPointerDown(event, groupId): void; onSelectMembers(groupId): void; onRename(groupId, title): void }`. `workspace.tsx`: `startGroupDrag(event, groupId)` — 멤버를 선택하고 기존 `kind: "node"` 제스처를 멤버 `startPositions`로 시작(이후 이동·한도·커밋은 노드 끌기와 같음).

- [ ] **Step 1: Failing test** (`test-workspace-editing.ts`, 하네스 이름 목록에 `startGroupDrag` 추가): `startGroupDrag selects members and moves them together in one undo step` — 노드 a·b가 그룹 g, c는 없음. `startGroupDrag(pointer, "g")` → 선택 `["a","b"]`, `moveGesture`(+40px 화면, zoom 0.5 → +80 캔버스) 뒤 a·b만 이동, `endGesture` 후 `past.length === 1`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `GroupLayer`: 영역은 `pointer-events-none` 둥근 16px 사각형(옅은 Moss 채움·테두리, `joinTargetId`면 진하게 + Moss Deep 테두리). 탭은 영역 왼쪽 위 바로 위에 붙은 버튼(`data-keyboard-control`): pointerdown → `onTabPointerDown`(짧게 누르면 멤버 선택이 됨), 더블클릭·Enter → 그 자리 입력(Enter·blur 적용, Esc 취소), Space → `onSelectMembers`. `interactive`가 false면(그리기 도구) 탭도 `pointer-events-none`. 캔버스 안 렌더 순서: `DrawingLayer` → `GroupLayer` → `ConnectionLayer` → 노드.
- [ ] **Step 4: Run** 테스트·`tsc`·`eslint`. 브라우저: 탭 끌기로 그룹 이동(유한 캔버스 가장자리 멈춤), 탭 짧게 누르면 멤버 선택, 이름 고치기·Esc 취소, Tab 포커스 후 Enter/Space.
- [ ] **Step 5: Commit** `git commit -m "Draw groups and move them by the name tab"`

### Task 4: 끌어서 들어가기

**Files:** Modify `workspace.tsx`, `scripts/test-workspace-editing.ts`

**Interfaces:** Consumes `groupAtPoint`, `canJoinByDrag`, `joinGroup`. Produces 노드 제스처 필드 `joinGroupId: string | null`, 상태 `joinTargetId`(GroupLayer 표시).

- [ ] **Step 1: Failing tests:**
  - `dragging ungrouped nodes onto a group joins on release in one undo step` — c를 그룹 g 영역 안으로 끌어 놓으면 c.groupId === g, `past.length === 1`.
  - `mixed drag does not join` — a(그룹 g)와 c를 함께 끌어 다른 그룹 h 위에 놓아도 c에 groupId 없음.
  - `cancelled drag does not join` — pointercancel이면 그대로.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `moveGesture`의 노드 분기에서 이동 후 커서 캔버스 좌표로 `canJoinByDrag(끄는 노드) ? groupAtPoint(이동 반영 문서, 점) : null`을 `gesture.joinGroupId`와 `joinTargetId`에 둔다. `endGesture`에서 pointerup이고 `joinGroupId`면 커밋 전에 `joinGroup`을 같은 트랜잭션으로 적용. 끝나면 `joinTargetId` 비움.
- [ ] **Step 4: Run** 테스트. 브라우저: 끄는 동안 그룹이 진해짐, 놓으면 들어가고 영역이 늘어남, 멤버를 밖으로 끌면 영역이 따라 늘어남.
- [ ] **Step 5: Commit** `git commit -m "Join a group by dropping nodes on it"`

### Task 5: 그룹화·해제 — 단축키와 우클릭 메뉴

**Files:** Create `src/features/workspace/node-context-menu.tsx`; Modify `workspace.tsx`, `shortcut-help.tsx`, `scripts/test-workspace-editing.ts`

**Interfaces:** Consumes `groupNodes`, `ungroupNodes`. Produces `groupSelection()`, `ungroupSelection()`(commit → change, 알림), `NodeContextMenu` props `{ left; top; canUngroup: boolean; onGroup(); onUngroup(); onClose() }`.

- [ ] **Step 1: Failing tests:** `G groups the selection in one undo step`(선택 a·c → 같은 새 그룹), `Shift+G ungroups`, `G with nothing selected does nothing`, `context menu key opens the node menu`(하네스에서 메뉴 열림 상태 기록).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** 단축키(`g`, Shift+`g`, `ContextMenu`·Shift+F10). 뷰포트 `onContextMenu`: 커서 아래 노드가 있으면 선택 규칙(선택에 없으면 그 노드만 선택) 후 메뉴를 커서 위치에 연다. 메뉴는 `connect-node-menu`와 같은 모양·키보드(↑/↓·Enter·Esc·바깥 닫기). 항목 "그룹화"(G), "그룹화 해제"(Shift+G, `canUngroup`일 때만). 단축키 도움말에 `["G", "선택한 노드 그룹화"]`, `["Shift + G", "그룹화 해제"]`.
- [ ] **Step 4: Run** 테스트. 브라우저: 우클릭 메뉴로 그룹화·해제, 키보드 메뉴 키, 빈 캔버스 우클릭은 메뉴 없음, 200개 알림은 단위 테스트로 대신.
- [ ] **Step 5: Commit** `git commit -m "Group and ungroup from shortcuts and a context menu"`

### Task 6: 문서와 마무리

**Files:** Create `docs/workspace-groups.md`; Modify `DESIGN.md`(Group 항목)

- [ ] 사용법·데이터·규칙·테스트 명령 문서. DESIGN.md에 Group 영역·탭·들어갈 것 표시.
- [ ] 최종 검사(전체 단위 테스트·tsc·eslint·prettier), 테스트 계정 삭제.
- [ ] `git commit -m "Document node groups"`
