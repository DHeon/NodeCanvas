# 체크리스트 노드 · 역할 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 노드에 "할 일" 역할을 붙이고, 연결선으로 이어진 할 일과 직접 쓴 항목을 모아 진행률을 보여주는 체크리스트 노드를 만든다.

**Architecture:** 체크 상태는 할 일 노드(`role`)에, 직접 항목은 체크리스트 노드(`items`)에 저장한다. 체크리스트 목록은 저장하지 않고 그릴 때 연결선에서 순수 함수(`buildChecklist`)로 계산한다. 모든 문서 변경은 기존 `dispatchHistory` commit → change 패턴으로 실행 취소 한 단계가 된다.

**Tech Stack:** Next.js 16 / React 19 (React Compiler) / TypeScript / zod 4 / Tailwind 4. 테스트는 `node --import tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-17-checklist-node-design.md`

## Global Constraints

- 노드 종류 문자열 `"checklist_node"`, 종류 이름 "체크리스트", 새 체크리스트 기본 제목 "체크리스트".
- 역할 `{ kind: "todo"; done: boolean }`, `NodeBase.role?`. 체크리스트 노드에는 역할 불가(스키마 거절).
- 직접 항목: 체크리스트당 최대 200개, 글은 앞뒤 공백 제거 후 1–200자, 항목 ID(uuid)는 체크리스트 안에서 유일.
- 단축키 K = 체크리스트 추가. 화면 문구는 모두 한국어. 아이콘은 `icons.tsx`의 1.8 굵기 선 아이콘.
- 색·그림자는 `globals.css` 토큰 유틸리티만(DESIGN.md). 크롬 글자는 이미 `chrome-no-select`로 선택이 막혀 있다.
- 바꾼 파일만 prettier로 맞춘다. 검사: `node node_modules/typescript/bin/tsc --noEmit`, `npx eslint src scripts`, 단위 테스트(`scripts/test-*.ts`, auth-projects·integration 제외).

## Review Focus

1. **같은 할 일과 선이 둘 이상:** 목록에 한 번만, 진행률도 한 번만 센다. → Task 2 `buildChecklist counts a node once`.
2. **직접 항목 글을 비우거나 공백만 넣고 적용:** 빈 글이 저장되면 다음 자동 저장이 스키마에서 거절된다. 항목이 지워져야 한다. → Task 2 `editChecklistItem with blank text removes the item`.
3. **200자 넘는 글 붙여넣기:** 200자로 잘라 저장한다(거절하지 않음). → Task 2 `addChecklistItem truncates to 200 chars`.
4. **여러 노드 선택에 체크리스트가 섞인 채 역할 지정:** 체크리스트는 건너뛴다(역할이 붙으면 저장 거절). → Task 2 `setRole skips checklist nodes`.
5. **체크리스트 목록 위에서 휠:** 목록이 스크롤되고 캔버스가 확대되지 않는다. → Task 5 브라우저 확인.

---

### Task 1: 데이터 모델과 스키마

**Files:**

- Modify: `src/features/workspace/types.ts`, `src/features/workspace/workspace-schema.ts`
- Create: `scripts/test-checklist.ts`

**Interfaces:**

- Produces: `type NodeRole = { kind: "todo"; done: boolean }`, `NodeBase.role?: NodeRole`, `type ChecklistItem = { id: string; text: string; done: boolean }`, `type ChecklistNode = NodeBase & { type: "checklist_node"; items: ChecklistItem[] }`, `WorkspaceNode`에 `ChecklistNode` 추가. 상수는 Task 2의 `checklist.ts`가 아니라 스키마가 먼저 필요하므로 `checklist.ts`에 `MAX_CHECKLIST_ITEMS = 200`, `MAX_CHECKLIST_ITEM_LENGTH = 200`을 이 태스크에서 만든다(파일만 생성).

- [ ] **Step 1: Write failing tests** in `scripts/test-checklist.ts` (fixture: 루트에 텍스트 노드 하나와 체크리스트 하나):
  - `schema accepts todo role and checklist with items` — 텍스트 노드 `role: { kind: "todo", done: true }`, 체크리스트 `items: [{ id, text: "우유 사기", done: false }]` → `workspaceDocumentSchema.safeParse(...).success === true`.
  - `schema rejects role on checklist` — 체크리스트에 `role` → false.
  - `schema rejects bad items` — 201개, 빈 글 `""`, 공백만 `"  "`, 201자, 같은 ID 두 번 → 각각 false.
  - `schema rejects unknown role kind` — `{ kind: "question", done: false }` → false.
  - `old documents still parse` — 역할·체크리스트 없는 문서 → true.
- [ ] **Step 2: Run** `node --import tsx --test scripts/test-checklist.ts` → FAIL (타입/스키마 없음).
- [ ] **Step 3: Implement** 타입과 스키마. `nodeBaseSchema`에 `role: z.strictObject({ kind: z.literal("todo"), done: z.boolean() }).optional()`. 체크리스트 스키마는 `nodeBaseSchema.extend({ type: z.literal("checklist_node"), role: z.undefined().optional(), items: z.array(itemSchema).max(200).refine(ID 유일) })`, 항목 글은 `z.string().max(200).refine(v => v.trim().length > 0 && v === v.trim())`. 두 discriminatedUnion(깊이 제한 안/밖) 모두에 넣는다.
- [ ] **Step 4: Run** 같은 명령 → PASS. `tsc --noEmit`에서 `WorkspaceNode` 분기가 빠진 곳(예: `workspace-tree.ts` 종류 이름, `node-frame.tsx` 라벨, `project-preview.tsx` 색)이 오류로 나오면 이 태스크에서 최소 값으로 채운다: 종류 이름 "체크리스트", 미리보기 색 `var(--color-moss-wash)`.
- [ ] **Step 5: Commit** `git commit -m "Add node roles and the checklist node to the document schema"`

### Task 2: 역할·체크리스트 순수 함수

**Files:**

- Create: `src/features/workspace/roles.ts`
- Modify: `src/features/workspace/checklist.ts`
- Test: `scripts/test-checklist.ts`

**Interfaces:**

- Consumes: Task 1 타입, `updateWorkspaceAtPath(root, path, update)`, `nodeDisplayName`.
- Produces (`roles.ts`):
  - `canHaveRole(node: WorkspaceNode): boolean` — 체크리스트면 false.
  - `setRole(root: WorkspaceDocument, path: readonly string[], nodeIds: readonly string[], role: "todo" | null): WorkspaceDocument` — 체크리스트 건너뜀. `"todo"`는 이미 할 일이면 `done` 유지, 아니면 `done: false`. `null`은 `role` 필드 삭제. 바뀐 게 없으면 같은 객체 반환.
  - `setTodoDone(root, path, nodeId: string, done: boolean): WorkspaceDocument` — 할 일이 아니면 그대로.
  - `roleForConnectedNode(sources: readonly WorkspaceNode[], type: WorkspaceNode["type"]): NodeRole | undefined` — 출발 노드 중 체크리스트가 있고 새 종류가 체크리스트가 아니면 `{ kind: "todo", done: false }`.
- Produces (`checklist.ts`):
  - `type ChecklistEntry = { kind: "node"; node: WorkspaceNode; done: boolean } | { kind: "item"; item: ChecklistItem }`
  - `type ChecklistView = { entries: ChecklistEntry[]; done: number; total: number; unassignedNodeIds: string[] }`
  - `buildChecklist(document: WorkspaceDocument, checklistId: string): ChecklistView` — 연결된 할 일(중복 제거, 위치 y→x 순) 다음 직접 항목. `unassignedNodeIds`: 이어졌지만 역할 없는 노드(체크리스트 제외), 위치 순.
  - `addChecklistItem(root, path, checklistId, text: string, makeId: () => string): { document: WorkspaceDocument } | { error: string }` — trim, 200자로 자름, 빈 글이면 `{ document: root }`(아무 일 없음), 200개 넘으면 `{ error: "항목은 체크리스트마다 200개까지 넣을 수 있어요." }`.
  - `editChecklistItem(root, path, checklistId, itemId, patch: { text?: string; done?: boolean }): WorkspaceDocument` — text는 trim·200자 자름, 빈 글이면 항목 삭제.
  - `removeChecklistItem(root, path, checklistId, itemId): WorkspaceDocument`

- [ ] **Step 1: Write failing tests** (fixture: 체크리스트 C, 할 일 A(y 300), 할 일 B(y 100), 역할 없는 D, 다른 체크리스트 E, 선 C–A 두 개(다른 변), C–B, D–C, C–E, C.items 2개(하나 done)):
  - `buildChecklist lists connected todos by position then items` — entries 순서 B, A, 항목1, 항목2.
  - `buildChecklist counts a node once` — A가 한 번만, total 4, done은 실제 done 수.
  - `buildChecklist reports unassigned nodes but not checklists` — `unassignedNodeIds` = [D].
  - `buildChecklist on empty checklist` — entries [], total 0.
  - `setRole skips checklist nodes` — `setRole(root, [], [A, C, D], "todo")` → C에 role 없음, D는 `{todo,false}`, A의 done 유지.
  - `setRole null removes role field` — `"role" in node === false`.
  - `setTodoDone toggles and ignores non-todo`.
  - `roleForConnectedNode` — 체크리스트 출발+텍스트 → todo, 체크리스트 출발+체크리스트 → undefined, 텍스트 출발 → undefined.
  - `addChecklistItem adds trimmed item` / `addChecklistItem truncates to 200 chars` / `addChecklistItem ignores blank` / `addChecklistItem refuses the 201st` (error 문구 일치).
  - `editChecklistItem with blank text removes the item` / `editChecklistItem toggles done`.
  - `removeChecklistItem removes by id`.
  - `duplicateNodes copies the checklist link when todos are copied together` — `duplicateNodes(doc, [C, A], 24)`의 새 체크리스트와 새 A 사이 선이 있고 `buildChecklist`에 새 A가 나온다.
- [ ] **Step 2: Run** `node --import tsx --test scripts/test-checklist.ts` → FAIL.
- [ ] **Step 3: Implement** `roles.ts`와 `checklist.ts`의 함수.
- [ ] **Step 4: Run** → PASS. 스키마로 결과 문서가 통과하는지 각 편집 테스트 끝에 `workspaceDocumentSchema.safeParse(result).success` 확인.
- [ ] **Step 5: Commit** `git commit -m "Add role and checklist operations"`

### Task 3: 검색에 직접 항목 글 포함

**Files:** Modify `src/features/workspace/search.ts`; Test `scripts/test-workspace-search.ts`

- [ ] **Step 1: Failing test** `checklist item text is searchable` — 체크리스트 항목 "우유 사기" → `searchWorkspace(root, "우유", [])`가 그 체크리스트를 찾는다.
- [ ] **Step 2: Run** `node --import tsx --test scripts/test-workspace-search.ts` → FAIL.
- [ ] **Step 3: Implement** `searchableText`에 `checklist_node`면 항목 글들을 더한다.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `git commit -m "Search checklist items"`

### Task 4: 할 일 노드의 체크 버튼

**Files:** Modify `src/features/workspace/node-frame.tsx`, `src/features/workspace/workspace.tsx`; Test `scripts/test-node-frame.ts`

**Interfaces:**

- Consumes: `setTodoDone` (Task 2).
- Produces: `NodeFrameProps.onToggleTodo?: (nodeId: string, done: boolean) => void`; `workspace.tsx`의 `toggleTodoNode(nodeId: string, done: boolean)` (commit → change, 현재 경로).

- [ ] **Step 1: Failing tests** in `test-node-frame.ts`:
  - `todo node shows a check button` — role todo/false → `<button` with `data-todo-check` and `aria-pressed="false"`, aria-label `할 일 완료로 표시`; 노드 aria-label에 `, 할 일` 포함.
  - `done todo is struck through` — done true → 제목 span에 `line-through`, 버튼 `aria-pressed="true"`, aria-label `할 일 완료 취소`, 노드 aria-label에 `, 할 일 완료`.
  - `no role, no check button` — `data-todo-check` 없음.
- [ ] **Step 2: Run** `node --import tsx --test scripts/test-node-frame.ts` → FAIL.
- [ ] **Step 3: Implement** 제목 왼쪽 둥근 체크 버튼(18px, 완료면 Moss Deep 채움 + 흰 체크). `onPointerDown`·`onDoubleClick` 전파를 막아 끌기·제목 편집과 겹치지 않게 한다. 완료면 제목 `line-through text-lichen`. `workspace.tsx`에서 `frame`에 `onToggleTodo: toggleTodoNode`.
- [ ] **Step 4: Run** → PASS, `tsc`.
- [ ] **Step 5: Commit** `git commit -m "Show a check button on todo nodes"`

### Task 5: 체크리스트 노드 화면과 만들기

**Files:**

- Create: `src/features/workspace/checklist-node-view.tsx`
- Modify: `workspace.tsx`, `workspace-toolbar.tsx`, `connect-node-menu.tsx`, `icons.tsx`, `shortcut-help.tsx`
- Test: `scripts/test-workspace-editing.ts`

**Interfaces:**

- Consumes: `buildChecklist`, `addChecklistItem`, `editChecklistItem`, `removeChecklistItem`, `setRole`, `setTodoDone`, `roleForConnectedNode`.
- Produces:
  - `ChecklistNodeView` props: `Omit<NodeFrameProps, "node" | "children"> & { node: ChecklistNode; view: ChecklistView; onToggleNode(nodeId: string, done: boolean): void; onAddItem(text: string): boolean; onEditItem(itemId: string, patch: { text?: string; done?: boolean }): void; onRemoveItem(itemId: string): void; onMakeTodos(nodeIds: string[]): void; onFocusNode(nodeId: string): void }`.
  - `workspace.tsx`: `addChecklistItemTo(checklistId, text): boolean`(오류면 `setNotice`, false), `editChecklistItemIn`, `removeChecklistItemFrom`, `makeTodos(nodeIds)`(= `setRole(..., "todo")`), `focusNodeById(nodeId)`(검색 고르기의 가운데 맞추기·선택 로직을 이 함수로 빼서 `pickSearchResult`와 함께 쓴다).
  - `icons.tsx`: `ChecklistIcon`.

- [ ] **Step 1: Failing tests** in `test-workspace-editing.ts`:
  - 단축키: `key("k")` → `calls`에 `"add:checklist_node"`.
  - 메뉴 항목 순서는 화면 테스트 대상이 아니므로 생략.
- [ ] **Step 2: Run** `node --import tsx --test scripts/test-workspace-editing.ts` → FAIL.
- [ ] **Step 3: Implement**
  - `addNode`: 크기 `checklist_node: [300, 340]`, 노드 `{ ...base, type, title: "체크리스트", items: [] }`. `at`(이어서 만들기)이면 `roleForConnectedNode(출발 노드들, type)`를 새 노드 `role`로.
  - 단축키 `k`, 도구 막대 버튼(aria-label "체크리스트 노드 추가", title "체크리스트 노드 추가 (K)"), 이어서 만들기 메뉴 항목(라벨 "체크리스트", 키 `k`), 단축키 도움말 `["K", "체크리스트 노드 추가"]`.
  - `ChecklistNodeView` (스펙 "체크리스트 노드 화면" 그대로): 진행률 줄("N / M 완료 · P%" + 막대, 모두 끝나면 "모두 완료", 0개면 "항목을 추가하거나 할 일 노드를 연결해 보세요."), 연결된 할 일 줄(체크 상자 + 제목 버튼 → `onFocusNode` + 노드 표시 아이콘), 직접 항목 줄(체크 상자 + 글 클릭 시 그 자리 입력, Enter·blur 적용, Esc 취소, `×` 지우기), 맨 아래 "항목 추가" 입력(Enter 추가 후 입력 비우고 유지, 한글 조합 무시, `maxLength=200`), 역할 없는 연결 노드 안내("역할이 없는 연결 노드 N개" + "할 일로 만들기" 버튼).
  - 목록 영역에 `data-scroll-region` 속성을 달고 뷰포트 휠 처리기 예외 선택자에 `[data-scroll-region]`을 더한다. 목록 안 상호작용 요소는 `onPointerDown` 전파를 막아 노드 끌기·범위 선택이 시작되지 않게 한다.
  - 렌더 분기에서 `buildChecklist(workspace, node.id)`를 넘긴다.
- [ ] **Step 4: Run** 모든 단위 테스트, `tsc`, `eslint`. 브라우저(테스트 계정): 도구 막대·K로 만들기, 항목 추가·고치기·비워서 삭제·×, 할 일 연결 → 목록·진행률, 목록 체크 ↔ 노드 체크 버튼 동기, 같은 노드에 선 둘 → 한 번, 역할 없는 노드 연결 → 안내 → "할 일로 만들기", 체크리스트에서 이어서 만들기 → 역할 붙음, 제목 누르면 그 노드로 이동, 목록 위 휠은 스크롤, 실행 취소 한 단계씩, 자동 저장 성공.
- [ ] **Step 5: Commit** `git commit -m "Add the checklist node"`

### Task 6: 속성 패널 "역할"

**Files:** Modify `src/features/workspace/workspace-properties.tsx`, `workspace.tsx`

**Interfaces:**

- Consumes: `setRole`, `setTodoDone`, `canHaveRole`.
- Produces: `WorkspaceProperties` props `onRoleChange(nodeIds: string[], role: "todo" | null): void`, `onTodoDone(nodeId: string, done: boolean): void`.

- [ ] **Step 1: Implement** "역할" 칸(기존 칸 나눔 선택 패턴, 선택지 "없음"/"할 일"). 하나 선택: 체크리스트면 숨김, 할 일이면 "완료" 체크 상자. 여러 개: 체크리스트를 뺀 노드 기준, 섞이면 둘 다 꺼진 상태 + "여러 가지" 표시, 모두 체크리스트면 숨김. "할 일" 칸 아래 한 줄 안내 "체크리스트 노드에 연결하면 목록에 들어가요."
- [ ] **Step 2: Verify** `tsc`, `eslint`, 단위 테스트. 브라우저: 하나·여러 개(체크리스트 섞음)에서 역할 바꾸기, "없음"으로 바꾸면 체크 버튼 사라짐, 실행 취소 한 단계.
- [ ] **Step 3: Commit** `git commit -m "Choose a node role in the properties panel"`

### Task 7: 문서와 마무리

**Files:** Create `docs/workspace-checklist.md`; Modify `DESIGN.md`

- [ ] **Step 1:** `docs/workspace-checklist.md` — 사용법, 데이터(역할·항목), 제한(200/200), 목록 규칙, 테스트 명령.
- [ ] **Step 2:** `DESIGN.md`에 Checklist Node, Todo Check 항목.
- [ ] **Step 3: Final verify** 모든 단위 테스트, `tsc`, `eslint src scripts`, 바꾼 파일 prettier. 테스트 계정 삭제.
- [ ] **Step 4: Commit** `git commit -m "Document the checklist node"`
