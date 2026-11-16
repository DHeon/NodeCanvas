# 노드 태그·검색 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 노드에 색 있는 태그를 달고, 프로젝트 전체(하위 캔버스 포함)를 태그·내용으로 검색해 흐림·강조·이동까지 하는 기능을 만든다.

**Architecture:** 루트 `WorkspaceDocument.tags`에 태그 목록(이름·색)을 두고 노드는 `NodeBase.tags`에 태그 ID만 둔다. 태그 조작과 검색은 문서 루트를 받는 순수 함수(`tags.ts`, `search.ts`)로 만들고, 편집기는 기존 `setWorkspace`/`dispatchHistory` 흐름으로 결과를 적용한다. 검색 상태는 화면 상태(React state)라 문서·Undo·URL에 남지 않는다.

**Tech Stack:** Next.js 16 App Router, React 19 (React Compiler), TypeScript strict, zod 4, Tailwind 4(세이지 토큰), node:test + tsx.

**Spec:** `docs/superpowers/specs/2026-11-16-node-tags-search-design.md`

## Global Constraints

- 태그 이름: 1~30자, 앞뒤 공백 제거, 앞의 `#` 제거, 공백·`#` 포함 금지, 대소문자 무시 중복 금지.
- 제한: 프로젝트 태그 `MAX_PROJECT_TAGS = 200`, 노드당 `MAX_NODE_TAGS = 20`. 넘으면 `setNotice`로 알린다.
- 색은 `CONNECTION_COLORS`(8색, `connection-colors.ts`)의 이름. 새 태그는 가장 적게 쓴 색, 같으면 팔레트 순서상 앞.
- `tags` 필드는 비면 저장하지 않는다(생략). 하위 문서(깊이 ≥ 1)에는 `tags` 목록이 없다.
- 검색: 낱말 AND, 대소문자 무시, `#낱말`은 그 이름으로 **시작하는** 태그, 150ms 디바운스, 결과 최대 100개, 흐림 불투명도 25%.
- 모든 문구는 한국어. 색·그림자는 `globals.css` 토큰 유틸리티만(DESIGN.md).
- 시작 전: `src/features/workspace/workspace.tsx`에 펜·지우개 작업의 커밋 안 된 변경이 있다. 되돌리지 말고, 사용자에게 먼저 커밋 여부를 확인한 뒤 그 위에 작업한다.
- 검증 명령: 단위 `node --import tsx --test scripts/<파일>.ts`, 타입 `node node_modules/typescript/bin/tsc --noEmit`, 린트 `npx eslint src scripts`. 포맷은 바꾼 파일만 `npx prettier --write <파일들>`(전체 `src`에 돌리지 않는다).

## Review Focus

1. **태그 삭제 후 하위 캔버스의 노드**: 깊은 하위 캔버스 노드에서도 ID가 빠져야 하고, 남으면 다음 저장이 스키마에서 400으로 거절된다. → Task 2 테스트 `deleteTag removes ids at every depth`.
2. **복제·Undo로 생긴 고아 태그 ID**: 태그 삭제 후 Undo, 또는 삭제 전 복제한 노드. Undo는 목록과 노드를 함께 되돌리므로 일관된다. 다만 스키마는 고아 ID를 반드시 거절해야 한다. → Task 1 테스트 `rejects node tag id missing from registry`.
3. **대소문자만 다른 새 태그**: `UI`가 있는데 `ui`를 입력하면 새로 만들지 않고 기존 태그를 붙인다. → Task 2 테스트 `createOrFindTag reuses case-insensitive match`.
4. **한글 조합 중 Enter**: 태그 입력칸에서 조합 확정 Enter가 태그를 만들면 안 된다(`isComposing`/keyCode 229 무시). → Task 5 Step에 명시, 수동 확인.
5. **검색 중 노드가 지워지거나 캔버스를 이동**: 결과는 매 렌더 문서에서 다시 계산하므로 없는 노드를 가리키지 않는다. 클릭 시 노드가 없으면 아무것도 안 한다. → Task 3 테스트 `results recompute after node removal`, Task 7 구현 조건.

---

### Task 1: 태그 데이터 모델과 스키마

**Files:**
- Modify: `src/features/workspace/types.ts` (`NodeBase`, `WorkspaceDocument`)
- Modify: `src/features/workspace/workspace-schema.ts` (`nodeBaseSchema`, `documentSchemaAtDepth`, 루트 `superRefine`)
- Create: `src/features/workspace/tags.ts` (상수와 타입만, Task 2에서 함수 추가)
- Test: `scripts/test-node-tags.ts`

**Interfaces:**
- Produces:
  - `export type TagDefinition = { id: string; name: string; color: ConnectionColor }` (in `types.ts`)
  - `NodeBase.tags?: string[]`, `WorkspaceDocument.tags?: TagDefinition[]`
  - `tags.ts`: `MAX_PROJECT_TAGS = 200`, `MAX_NODE_TAGS = 20`, `MAX_TAG_NAME_LENGTH = 30`

- [ ] **Step 1: Write the failing tests** in `scripts/test-node-tags.ts`
  - `round-trips tags registry and node tags`: 루트에 태그 2개, 노드 2개에 태그 ID, 하위 캔버스 노드에도 태그 ID → `workspaceDocumentSchema.parse(doc)`가 `doc`와 같다.
  - `opens documents without tags`: 태그 필드 없는 문서가 그대로 통과.
  - `rejects tags registry inside sub-canvas`: 하위 `document.tags = [...]` → `safeParse(...).success === false`.
  - `rejects node tag id missing from registry`: 목록에 없는 uuid를 노드(하위 캔버스 노드 포함 각각)에 → false.
  - `rejects duplicate tag names ignoring case`: `UI`와 `ui` → false. 같은 id 두 번 → false.
  - `rejects tag name rules`: 빈 이름, 31자, 공백 포함, `#` 포함 → false.
  - `rejects limits`: 태그 201개 → false. 노드 하나에 태그 21개 → false. 노드 안 같은 ID 두 번 → false.

- [ ] **Step 2: Run to verify fail**
  Run: `node --import tsx --test scripts/test-node-tags.ts` → FAIL (스키마가 `tags`를 모름).

- [ ] **Step 3: Implement**
  - `nodeBaseSchema`에 `tags: z.array(z.uuid()).max(MAX_NODE_TAGS).refine(unique).optional()`.
  - `documentSchemaAtDepth(depth)`: 깊이 0에서만 `tags: z.array(tagDefinitionSchema).max(MAX_PROJECT_TAGS).optional()`를 객체에 포함(strictObject라 하위 깊이에선 키 자체가 거절됨).
  - `tagDefinitionSchema = z.strictObject({ id: z.uuid(), name: z.string().regex(/^[^\s#]{1,30}$/), color: z.enum(CONNECTION_COLOR_KEYS) })`.
  - 루트 `superRefine`: 목록 id·소문자 이름 중복 검사, `walkWorkspaceNodes`로 모든 노드의 `tags`가 목록 id 집합에 있는지 검사.

- [ ] **Step 4: Run to verify pass** — 같은 명령 PASS. `tsc --noEmit` 통과. 기존 `scripts/test-workspace-tree.ts`, `test-link-node.ts`, `test-text-style.ts`, `test-drawing.ts`도 PASS.

- [ ] **Step 5: Commit** — `git add src/features/workspace/types.ts src/features/workspace/workspace-schema.ts src/features/workspace/tags.ts scripts/test-node-tags.ts && git commit -m "Add tag registry and node tags to the document schema"`

---

### Task 2: 태그 조작 순수 함수

**Files:**
- Modify: `src/features/workspace/tags.ts`
- Test: `scripts/test-node-tags.ts` (같은 파일에 추가)

**Interfaces:**
- Consumes: Task 1의 타입·상수, `updateWorkspaceAtPath`, `walkWorkspaceNodes`, `CONNECTION_COLORS`.
- Produces (모두 순수, 입력 문서를 바꾸지 않고 새 루트를 돌려준다. 바뀐 게 없으면 같은 객체):
  - `normalizeTagName(input: string): string | null`
  - `findTagByName(root: WorkspaceDocument, name: string): TagDefinition | undefined` (대소문자 무시)
  - `pickTagColor(root: WorkspaceDocument): ConnectionColor`
  - `createOrFindTag(root, name: string): { document: WorkspaceDocument; tag: TagDefinition } | { error: string }`
  - `attachTag(root, path: readonly string[], nodeIds: readonly string[], tagId: string): { document: WorkspaceDocument; skipped: number }` — 이미 있는 노드는 건너뜀(skipped 아님), 20개 찬 노드는 skipped에 셈.
  - `detachTag(root, path, nodeIds, tagId): WorkspaceDocument` — 빈 배열이 되면 `tags` 필드 삭제.
  - `renameTag(root, tagId, name): { document } | { error: string }`, `recolorTag(root, tagId, color: ConnectionColor): WorkspaceDocument`
  - `deleteTag(root, tagId): WorkspaceDocument` — 목록과 모든 깊이 노드에서 제거.
  - `countTagUsage(root): Map<string, number>` — 모든 깊이 노드 기준.

- [ ] **Step 1: Write the failing tests**
  - `normalizeTagName`: `" #UI "` → `"UI"`, `""`/`"a b"`/`"a#b"`/31자 → `null`.
  - `createOrFindTag reuses case-insensitive match`: `UI` 있을 때 `ui` → 같은 tag, 문서 변화 없음(`===`).
  - `createOrFindTag` 새 태그: 목록에 추가, id는 uuid, 200개면 `{ error }`.
  - `pickTagColor`: 빈 문서 → `"lichen"`. lichen 1개 쓰였으면 → `"moss"`. 모두 1개씩이면 → `"lichen"`.
  - `attachTag partial`: 노드 A(태그 0개), B(20개) → A에만 붙고 `skipped === 1`. 모두 가득 → 같은 문서 객체, `skipped === 2`.
  - `attachTag`/`detachTag`는 지정 `path`의 하위 캔버스 노드에만 적용(다른 깊이 같은 id 없음 확인), detach 후 빈 배열이면 `"tags" in node === false`.
  - `renameTag`: 다른 태그와 대소문자 무시 중복이면 `{ error }`, 규칙 위반 이름이면 `{ error }`.
  - `deleteTag removes ids at every depth`: 깊이 0·2 노드 모두에서 사라지고 결과가 `workspaceDocumentSchema`를 통과.
  - `countTagUsage`: 깊이별 노드를 합산.

- [ ] **Step 2: Run to verify fail** — `node --import tsx --test scripts/test-node-tags.ts` → 새 테스트 FAIL.
- [ ] **Step 3: Implement** the signatures above in `tags.ts`. 깊이 전체 갱신은 `updateWorkspaceAtPath`와 같은 방식의 재귀(`node.type === "canvas_node"`면 `document`를 다시 처리)로 한다.
- [ ] **Step 4: Run to verify pass** — PASS, `tsc` 통과.
- [ ] **Step 5: Commit** — `git commit -m "Add pure tag operations"`

---

### Task 3: 검색 순수 함수

**Files:**
- Create: `src/features/workspace/search.ts`
- Test: `scripts/test-workspace-search.ts`

**Interfaces:**
- Consumes: `WorkspaceDocument`, `TagDefinition`, `nodeDisplayName`, `canvasNodeTitle`.
- Produces:
  - `export const MAX_SEARCH_RESULTS = 100`
  - `export type SearchQuery = { words: string[]; tagPrefixes: string[] }`, `parseSearchQuery(input: string): SearchQuery` (소문자화, `#`로 시작하는 낱말은 `tagPrefixes`, `#` 하나만이면 무시)
  - `export type SearchResult = { node: WorkspaceNode; path: string[] /* 노드를 담은 캔버스 경로 */; trail: string[] /* 경로 캔버스 제목들 */; anchorId: string | null }`
  - `searchWorkspace(root: WorkspaceDocument, input: string, currentPath: readonly string[]): { results: SearchResult[]; total: number; truncated: boolean }`
  - `countNestedMatches(results: readonly SearchResult[], currentPath: readonly string[]): Map<string, number>` — 지금 캔버스의 캔버스 노드 ID → 그 아래 모든 깊이 결과 수(자기 자신 제외).
- 규칙: 낱말 하나가 맞는 곳 = 노드 `title`, `text_node.text`, `link_node.url`, `link_node.preview?.title`, 노드 태그 이름. 모든 낱말·모든 태그 접두가 맞아야 결과. `anchorId` = 노드가 지금 캔버스에 있으면 그 노드 id, 지금 캔버스 아래에 있으면 지금 캔버스에 있는 조상 캔버스 노드 id, 그 밖이면 `null`. 정렬: `anchorId === node.id`(지금 캔버스) 먼저 → 그다음 경로 길이 오름차순, 같으면 문서 순서.

- [ ] **Step 1: Write the failing tests**
  - `parseSearchQuery("UI #디자인 버튼")` → `{ words: ["ui","버튼"], tagPrefixes: ["디자인"] }`.
  - `matches all words (AND) ignoring case`, `matches text body, link title, tag name`.
  - `#prefix matches tags starting with prefix only`: `#디` → `디자인` 태그 노드 O, `내디자인` X.
  - `includes sub-canvas results with path and trail`, `current canvas first then shallower`.
  - `anchorId`: 지금 캔버스 노드 → 자기 id, 하위 결과 → 그 하위를 담은 지금 캔버스의 캔버스 노드 id, 상위/옆 캔버스 결과 → `null`.
  - `countNestedMatches` 자기 자신 제외, 모든 깊이 합산.
  - `caps at 100 with truncated`: 노드 120개 → `results.length === 100`, `total === 120`, `truncated === true`.
  - `empty query returns no results`.
  - `results recompute after node removal`: 노드 삭제한 문서로 다시 부르면 그 노드가 없음.
- [ ] **Step 2: Run to verify fail** — `node --import tsx --test scripts/test-workspace-search.ts` FAIL.
- [ ] **Step 3: Implement** in `search.ts`.
- [ ] **Step 4: Run to verify pass** — PASS, `tsc` 통과.
- [ ] **Step 5: Commit** — `git commit -m "Add workspace search over nested canvases"`

---

### Task 4: 노드 머리 태그 점과 검색 표시 상태

**Files:**
- Modify: `src/features/workspace/node-frame.tsx` (props·머리)
- Modify: `src/features/workspace/canvas-node-view.tsx` (배지)
- Test: `scripts/test-node-frame.ts`

**Interfaces:**
- Produces (새 선택 props, 기본값은 지금 모양과 같다):
  - `NodeFrameProps.tags?: TagDefinition[]` — 이미 해석된 태그(ID→정의).
  - `NodeFrameProps.searchState?: "none" | "match" | "dimmed"` — `dimmed`면 article에 `opacity-25`(전환 150ms, 움직임 줄이기 존중).
  - `NodeFrameProps.highlighted?: boolean` — Moss Deep 두 겹 링(`ring-2 ring-moss-deep ring-offset-2 ring-offset-field`) + 400ms 밝아짐.
  - `CanvasNodeView`의 `searchCount?: number` — 0보다 크면 머리 옆 "N개" 배지(Moss Wash 바탕, 12px).

- [ ] **Step 1: Write the failing tests** (renderToStaticMarkup)
  - 태그 4개 → 점 3개(`data-tag-dot` 3개)와 `+1`, 머리에 `title`로 네 이름이 쉼표로.
  - `aria-label`에 태그 이름 포함(`태그: UI, 회의`).
  - `searchState: "dimmed"` → 마크업에 `opacity-25`, `"match"`·없음 → 없음.
  - 태그 없음 → `data-tag-dot` 없음(기존 테스트 그대로 PASS).
- [ ] **Step 2: Run to verify fail** — `node --import tsx --test scripts/test-node-frame.ts` FAIL.
- [ ] **Step 3: Implement.** 점은 지름 8px 원, 색은 `connectionColor(tag.color).value`, 제목 `span`은 `min-w-0 flex-1 truncate`를 유지해 점이 항상 보이게 한다.
- [ ] **Step 4: Run to verify pass** — PASS, `tsc`, `npx eslint src/features/workspace` 통과.
- [ ] **Step 5: Commit** — `git commit -m "Show tag dots and search state on nodes"`

---

### Task 5: 속성 패널 태그 칸(하나·여러 개 선택)

**Files:**
- Create: `src/features/workspace/tag-input.tsx` (칩 목록 + 자동완성 입력 + 색 팔레트 팝오버)
- Modify: `src/features/workspace/workspace-properties.tsx` (하나 선택: "기본 정보" 아래 "태그" 칸 / 여러 선택: 안내 문구 대신 "공통 태그")
- Modify: `src/features/workspace/workspace.tsx` (핸들러·props·태그 해석 맵)

**Interfaces:**
- Consumes: Task 2의 `createOrFindTag`, `attachTag`, `detachTag`, `recolorTag`, `MAX_NODE_TAGS`; Task 4의 `NodeFrameProps.tags`.
- Produces:
  - `TagInput` props: `{ allTags: TagDefinition[]; applied: { tag: TagDefinition; partial: boolean }[]; onAdd(name: string): void; onFill(tagId: string): void; onRemove(tagId: string): void; onRecolor(tagId: string, color: ConnectionColor): void }`
  - `WorkspaceProperties` 새 props: `tags: TagDefinition[]`, `selectedNodes: WorkspaceNode[]`, `onTagAdd(nodeIds: string[], name: string)`, `onTagRemove(nodeIds: string[], tagId: string)`, `onTagRecolor(tagId: string, color: ConnectionColor)`.
  - `workspace.tsx`: `tagsById = new Map(rootDocument.tags?.map(...))`, 노드 렌더에 `tags`를 해석해 전달.

- [ ] **Step 1: Implement `TagInput`.**
  - 칩: 색 점 + 이름 + ✕(`aria-label="{이름} 태그 떼기"`). 부분 적용 칩은 `opacity-50`, 누르면 `onFill`.
  - 칩 이름을 누르면 8색 원 팝오버(라디오, Esc·바깥 클릭 닫기) → `onRecolor`.
  - 입력: 이름 포함 후보 최대 8개를 아래 목록으로, ↑/↓ 이동, Enter 선택. 후보가 없으면 Enter로 `onAdd(입력값)`. `event.nativeEvent.isComposing || event.keyCode === 229`면 무시. 입력칸 `onPointerDown`은 전파 중단.
- [ ] **Step 2: Wire handlers in `workspace.tsx`.**
  - `addTagToNodes(nodeIds, name)`: `normalizeTagName` 실패 → `setNotice("태그 이름은 공백과 #없이 30자까지 쓸 수 있어요.")`; `createOrFindTag` 에러 → notice; 성공 → `dispatchHistory({ type: "commit" })` 후 한 번의 `dispatchHistory({ type: "change", update })`로 목록 추가와 `attachTag`를 함께 적용(Undo 한 단계). `skipped > 0`이면 `setNotice(\`노드 ${skipped}개는 태그가 가득 차 붙이지 못했어요.\`)`. 모두 skipped면 문서를 바꾸지 않는다.
  - `removeTagFromNodes`, `recolorTagById`도 commit 후 change 한 번.
  - 경로는 `canvasPath.slice(0, activeDepth)`.
- [ ] **Step 3: Wire `WorkspaceProperties`.** 하나 선택이면 `applied`는 그 노드 태그(partial 없음). 여러 선택이면 선택 노드 태그 합집합, 모두에 있으면 partial false.
- [ ] **Step 4: Verify** — `tsc --noEmit`, `npx eslint src`, 모든 단위 테스트 PASS. 브라우저: 테스트 계정으로 노드에 태그 붙이기/새로 만들기/색 바꾸기, 두 노드 선택 후 공통 태그, 한글 조합 Enter가 태그를 만들지 않음, Undo 한 번에 붙이기가 취소됨, 머리 색 점 표시.
- [ ] **Step 5: Commit** — `git commit -m "Edit node tags from the properties panel"`

---

### Task 6: 메뉴바 "태그" 관리

**Files:**
- Modify: `src/features/workspace/workspace-menu.tsx` (메뉴 id `"tags"`, 라벨 "태그")
- Modify: `src/features/workspace/workspace.tsx` (props 전달)

**Interfaces:**
- Consumes: Task 2의 `renameTag`, `recolorTag`, `deleteTag`, `countTagUsage`.
- Produces: `WorkspaceMenu` 새 props `tags: TagDefinition[]`, `tagUsage: Map<string, number>`, `onTagRename(id, name): string | null`(에러 문구 또는 null), `onTagRecolor(id, color)`, `onTagDelete(id)`.

- [ ] **Step 1: Implement** 목록(색 원 버튼 → 팔레트, 이름 인라인 입력 Enter·blur 적용·Esc 취소, "노드 N개", 삭제 버튼). 태그가 없으면 "아직 태그가 없어요. 노드 속성에서 태그를 붙여보세요." 목록은 최대 높이 + 스크롤.
- [ ] **Step 2: Implement delete confirm** — `window.confirm(\`"${name}" 태그를 지울까요? 이 태그를 단 노드 ${count}개에서 모두 떨어집니다. 실행 취소로 되돌릴 수 있습니다.\`)`, 확인 시 commit 후 `deleteTag`. 노드 0개면 확인 없이 지운다.
- [ ] **Step 3: Verify** — `tsc`, eslint, 단위 테스트 PASS. 브라우저: 이름 변경(중복이면 오류 문구), 색 변경이 모든 노드 점에 반영, 하위 캔버스 노드가 쓰던 태그 삭제 후 저장 성공(자동 저장 "저장됨"), Undo로 복구.
- [ ] **Step 4: Commit** — `git commit -m "Manage tags from the menu bar"`

---

### Task 7: 검색 패널·흐림·강조·이동

**Files:**
- Create: `src/features/workspace/search-panel.tsx`
- Modify: `src/features/workspace/workspace.tsx` (상태, `Ctrl/Cmd+F`, 헤더 돋보기, 노드 props, 이동)
- Modify: `src/features/workspace/connection-layer.tsx` (흐림)
- Modify: `src/features/workspace/shortcut-help.tsx`
- Test: `scripts/test-workspace-editing.ts`

**Interfaces:**
- Consumes: Task 3의 `searchWorkspace`, `countNestedMatches`, `SearchResult`; Task 4의 `searchState`, `highlighted`, `searchCount`.
- Produces:
  - `SearchPanel` props: `{ query: string; onQueryChange(q: string): void; results: SearchResult[]; total: number; truncated: boolean; tags: TagDefinition[]; activeIndex: number; onActiveChange(index: number | null): void; onPick(result: SearchResult): void; onClose(): void }`
  - `ConnectionLayer` 새 prop `dimmedNodeIds?: ReadonlySet<string>` — 양 끝이 모두 여기 있으면 선 `opacity 0.25`.
  - `workspace.tsx`: `searchOpen`, `searchQuery`, 150ms 디바운스한 `debouncedQuery`, `hoveredResult`.

- [ ] **Step 1: Write the failing test** in `test-workspace-editing.ts` — 팩토리 스텁에 `openSearch` 추가. `Ctrl+F`가 입력칸 안(`new TestElement(true)`)에서도 `defaultPrevented`이고 `calls`에 `"search"`가 남는다. `handleWorkspaceKeyDown` 맨 앞(Ctrl+S와 같은 자리)에 둔다.
- [ ] **Step 2: Run to verify fail** — `node --import tsx --test scripts/test-workspace-editing.ts` FAIL.
- [ ] **Step 3: Implement `SearchPanel`.** 캔버스 오른쪽 위(`absolute top-3 right-3`, 폭 320px, `shadow-float`, 흰 바탕). 검색창(자동 포커스, `aria-label="노드 검색"`, `#`로 시작하는 마지막 낱말이면 태그 자동완성), "결과 N개", 목록(`role="listbox"`, 항목 `role="option"`, 이름·종류·태그 점·다른 캔버스면 경로). `truncated`면 "검색어를 더 좁혀보세요". ↓/↑로 `activeIndex`, Enter로 `onPick`, Esc로 `onClose`. 항목 `onPointerEnter`/`onFocus` → `onActiveChange(i)`, 목록에서 나가면 `null`.
- [ ] **Step 4: Wire in `workspace.tsx`.**
  - 헤더에 돋보기 아이콘 버튼(`aria-label="검색 (Ctrl+F)"`, `aria-keyshortcuts="Control+F Meta+F"`).
  - `const search = useMemo(() => searchWorkspace(rootDocument, debouncedQuery, activePath), ...)`. 검색어가 비면 흐림 없음.
  - 지금 캔버스 노드별 `searchState`: 결과 `anchorId`에 든 노드는 `"match"`, 나머지 `"dimmed"`. 손그림은 그대로.
  - `highlighted`: 호버 결과의 `anchorId`와 같은 노드. `searchCount`: `countNestedMatches` 값.
  - `onPick(result)`: 노드가 문서에 없으면 무시. 경로가 다르면 `writeCanvasPath(result.path, "push")`, 그 캔버스에서 노드 중심이 뷰포트 가운데 오도록 카메라 설정(공간 전환 후 카메라 복원 효과가 덮어쓰지 않도록 이동 대상을 ref에 두고 레이아웃 effect에서 적용), `setSelectedNodeIds([id])`, 펜·지우개 모드면 선택 모드로. 패널은 열어 둔다.
  - `Esc`로 닫으면 검색어를 비우고 흐림 해제.
- [ ] **Step 5: Implement connection dimming** with `dimmedNodeIds`.
- [ ] **Step 6: Add shortcut help line** — "화면" 그룹에 `["Ctrl + F", "노드 검색 (#태그)"]`.
- [ ] **Step 7: Verify** — 단위 테스트 전부 PASS, `tsc`, eslint. 브라우저(테스트 계정): 텍스트로 검색 시 나머지 노드 흐림, `#태그` 검색, 호버 강조, 하위 캔버스 결과 클릭 시 그 캔버스로 들어가 노드 가운데·선택, 지금 캔버스의 캔버스 노드 "N개" 배지, Esc로 원상복구, 입력칸에서 Ctrl+F가 브라우저 찾기 대신 패널을 연다. 검색은 Undo 이력을 늘리지 않는다(실행 취소 버튼 상태 변화 없음).
- [ ] **Step 8: Commit** — `git commit -m "Search nodes with dimming, highlight and jump"`

---

### Task 8: 문서와 마무리

**Files:**
- Create: `docs/workspace-tags-search.md`
- Modify: `DESIGN.md` (Tag 칩·색 점, Search Panel 컴포넌트 항목)

- [ ] **Step 1: Write `docs/workspace-tags-search.md`** — 사용법, 데이터(`tags` 목록·노드 ID), 제한(200/20/30자), 검색어 규칙, 흐림·강조·이동, 테스트 명령(`test-node-tags.ts`, `test-workspace-search.ts`).
- [ ] **Step 2: Update `DESIGN.md`** — Tag(8px 점, 칩: 점 + 12px 이름, 부분 적용은 50%), Search Panel(위치·폭·흐림 25%·강조 링).
- [ ] **Step 3: Final verify** — 모든 `scripts/test-*.ts` 단위 테스트(통합 테스트 제외), `tsc --noEmit`, `npx eslint src scripts`, 바꾼 파일 `npx prettier --check`. 브라우저 확인용 테스트 계정은 삭제한다.
- [ ] **Step 4: Commit** — `git commit -m "Document node tags and search"`
