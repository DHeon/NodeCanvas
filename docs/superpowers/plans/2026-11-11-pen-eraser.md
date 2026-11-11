# 펜·지우개 도구 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 캔버스 배경에 자유롭게 그리는 펜과, 문지른 부분만 지우는 지우개를 추가한다.

**Architecture:** 선은 공간(하위 캔버스)마다 `document.drawing.strokes`에 점 목록으로 저장된다. 기하 계산(점 추가·단순화·경로·지우기)은 React 없는 `drawing.ts`가 맡는다. `workspace.tsx`는 도구 상태와 포인터 제스처를 이 함수들에 연결한다. 렌더링은 노드보다 아래에 깔리는 SVG 층이 맡는다.

**Tech Stack:** Next.js 16 / React 19 (React Compiler), TypeScript, zod 4, Tailwind 4, `node --test` + tsx

**Spec:** `docs/superpowers/specs/2026-11-11-pen-eraser-design.md`

## Global Constraints
- 색은 `CONNECTION_COLORS`의 이름 8개(`ConnectionColor`)를 쓴다. 굵기는 `2 | 4 | 8`(캔버스 단위)이다.
- 한도:
  - 공간 하나의 선은 3,000개(`MAX_STROKES_PER_CANVAS`)
  - 선 하나의 점은 4,000개(`MAX_POINTS_PER_STROKE`, 숫자 8,000개)
  - 문서 전체의 점은 300,000개(`MAX_DRAWING_POINTS`)
- 좌표는 소수 첫째 자리로 반올림한다.
- 점 추가 최소 간격은 화면 1.5px(캔버스 `1.5 / zoom`)이다.
- 지우개 반지름은 화면 10px(캔버스 `10 / zoom`)이다.
- 단축키는 펜 `P`, 지우개 `E`, 선택 모드 복귀 `Esc`다. 같은 도구 버튼을 다시 눌러도 복귀한다.
- 디자인 규칙:
  - 아이콘은 `icons.tsx`에서 가져오고 유니코드 기호는 쓰지 않는다.
  - 글자는 12px 이상, 디자인 토큰만 쓴다.
  - 사용자 문구는 한국어로 쓴다.
- localStorage는 읽기와 쓰기를 모두 try/catch로 감싼다. 실패하면 기본값(`lichen`, `4`)을 쓴다.
- 테스트 명령(전체):
  ```bash
  node --import tsx --test scripts/test-app-origins.ts scripts/test-canvas-settings.ts scripts/test-node-frame.ts scripts/test-workspace-editing.ts scripts/test-workspace-images.ts scripts/test-workspace-save-client.ts scripts/test-workspace-tree.ts scripts/test-workspace-view.ts scripts/test-text-style.ts scripts/test-link-node.ts scripts/test-drawing.ts
  ```
- 타입 검사는 `node node_modules/typescript/bin/tsc --noEmit`, 린트는 `npx eslint src scripts`다. Prettier는 바꾼 파일에만 돌린다.

## Review Focus
1. **지우개로 선이 나뉘어 공간 한도 3,000개를 넘는 경우:** 그 지우기 동작 전체를 취소하고 알림을 띄워야 한다. 문서가 스키마를 어기면 저장이 막힌다. → Task 1(`eraseStrokes` 결과 길이는 호출 측이 검사)과 Task 3에서 테스트한다.
2. **아주 긴 선 하나(점 4,000개 초과):** 4,000점에서 더 이어지지 않아야 하고, 저장된 선은 스키마를 통과해야 한다. → Task 1 `appendPoint` 테스트.
3. **클릭만 한 펜(점 하나):** 점 모양으로 남고 스키마를 통과해야 한다. → Task 1·Task 2 테스트.
4. **그리는 도중 하위 캔버스 이동, 창 blur, pointercancel:** 그리던 획은 현재 공간에 확정되거나 버려지고, 다른 공간에 섞이면 안 된다. → Task 3. `clearGesture`에서 draw 제스처를 정리한다.
5. **`drawing`이 없는 이전 문서와 빈 `strokes`:** 그대로 열리고 저장돼야 한다. → Task 2 테스트.

---

### Task 1: 그리기 기하 함수 `drawing.ts`

**Files:**
- Create: `src/features/workspace/drawing.ts`
- Test: `scripts/test-drawing.ts`

**Interfaces:**
- Consumes: `ConnectionColor` from `./connection-colors`
- Produces:
  ```ts
  export const STROKE_WIDTHS = [2, 4, 8] as const;
  export type StrokeWidth = (typeof STROKE_WIDTHS)[number];
  export type DrawingStroke = { id: string; color: ConnectionColor; width: StrokeWidth; points: number[] };
  export const MAX_STROKES_PER_CANVAS = 3000;
  export const MAX_POINTS_PER_STROKE = 4000;
  export const MAX_DRAWING_POINTS = 300_000;
  export function appendPoint(points: number[], x: number, y: number, minDistance: number): number[];
  export function simplifyPoints(points: number[], tolerance: number): number[];
  export function strokePath(points: number[]): string;
  export function eraseStrokes(strokes: DrawingStroke[], eraser: number[], radius: number, createId: () => string): DrawingStroke[];
  export function countStrokePoints(strokes: DrawingStroke[]): number;
  ```

- [ ] **Step 1: 실패하는 테스트를 쓴다.** `scripts/test-drawing.ts`에 `node:test`와 `assert/strict`로 다음을 넣는다. `line(color?)`는 `{id:"s1", color:"lichen", width:4, points:[0,0,10,0,…,100,0]}`(x 0→100, 10 간격) 같은 픽스처 함수다.
  - `appendPoint`:
    - 빈 배열에 `(1.234, 5.678)` → `[1.2, 5.7]`
    - 직전 점과 거리가 `minDistance` 미만이면 **같은 배열 객체**를 돌려준다(`assert.equal`).
    - 점이 `MAX_POINTS_PER_STROKE`개(숫자 8,000개)인 배열에는 더 붙지 않는다(같은 객체).
  - `simplifyPoints`:
    - 일직선 위 11점 `[0,0, 10,0, …, 100,0]`을 tolerance 0.5로 줄이면 `[0,0,100,0]`이다.
    - 꺾인 선 `[0,0, 50,0, 50,50]`은 그대로다.
    - 점 1개 `[3,4]`는 그대로다.
  - `strokePath`:
    - `[3,4]` → `"M3 4l0.01 0"`
    - `[0,0,10,0]` → `"M0 0L10 0"`
    - 3점 이상은 `"M"`로 시작하고 `"Q"`를 포함하며 마지막 점으로 끝난다(`/L100 0$/`).
  - `eraseStrokes` (radius 5, 너비 4 선):
    - 지우개 `[50,-20, 50,20]`(가운데를 세로로 지남) → 결과가 2개다. 첫 선의 마지막 x는 50보다 작고 두 번째 선의 첫 x는 50보다 크다. 원래 색과 굵기를 유지하고, `createId`가 준 새 ID를 쓴다.
    - 지우개 `[100,-20, 100,20]`(끝) → 1개이고, 마지막 x < 100이다.
    - 지우개 `[0,0, 100,0]`(선 전체를 덮음) → `[]`
    - 지우개 `[0,500, 100,500]`(닿지 않음) → 결과 배열의 원소가 원래 선과 **같은 객체**다. 아무것도 지우지 못했으면 입력 배열 자체를 돌려준다(`assert.equal(result, strokes)`).
    - 점 하나 선 `[50,0]`에 지우개 `[50,-20, 50,20]` → `[]`
  - `countStrokePoints([line(), {…points:[1,2]}])` → 11 + 1 = 12

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다.**
  Run: `node --import tsx --test scripts/test-drawing.ts`
  Expected: FAIL. `Cannot find module '../src/features/workspace/drawing'`

- [ ] **Step 3: `drawing.ts`를 구현한다.**
  - `appendPoint`: 반올림은 `Math.round(v * 10) / 10`이다. 새 배열을 돌려준다(불변).
  - `simplifyPoints`: Ramer–Douglas–Peucker 재귀(또는 스택)로 줄이고 첫 점과 끝 점은 항상 남긴다.
  - `strokePath`: 점이 2개면 `L`로 잇는다. 3개 이상이면 `M p0`, 이어서 i=1..n-2마다 `Q p_i mid(p_i, p_{i+1})`, 마지막에 `L p_{n-1}`이다. 숫자는 `String(n)`을 쓴다.
  - `eraseStrokes`: 다음 알고리즘으로 구현한다.
    ```
    hitRadius = radius + stroke.width / 2
    각 선 segment(p_i→p_{i+1})를 길이 ≤ radius/2 간격으로 샘플링한 점 목록 S를 만든다(양 끝 포함, 중복 없이).
    점이 1개인 선은 S = [그 점].
    샘플마다 지우개 polyline(eraser 점이 1개면 그 점)까지의 최소 거리 ≤ hitRadius면 erased로 표시한다.
    지워진 샘플이 없으면 원래 stroke 객체를 그대로 쓴다.
    아니면 지워지지 않은 샘플의 연속 구간마다 새 stroke를 만든다
      { id: createId(), color, width, points: simplifyPoints(구간, 0.3) }.
    구간 길이가 1점이면 버린다.
    아무 선도 바뀌지 않았으면 입력 배열을 그대로 돌려준다.
    ```
    점과 선분 사이 거리는 내부 헬퍼 `distanceToSegment`로 계산한다.

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다.**
  Run: `node --import tsx --test scripts/test-drawing.ts`
  Expected: PASS(전부)

- [ ] **Step 5: 커밋한다.**
  ```bash
  git add src/features/workspace/drawing.ts scripts/test-drawing.ts
  git commit -m "Add drawing geometry helpers"
  ```

### Task 2: 문서 타입과 스키마

**Files:**
- Modify: `src/features/workspace/types.ts` (`WorkspaceDocument`)
- Modify: `src/features/workspace/workspace-schema.ts` (`documentSchemaAtDepth`, 루트 `superRefine`)
- Test: `scripts/test-drawing.ts` (스키마 테스트 추가)

**Interfaces:**
- Consumes: Task 1의 `DrawingStroke`, `STROKE_WIDTHS`, 한도 상수, `countStrokePoints`
- Produces: `WorkspaceDocument.drawing?: { strokes: DrawingStroke[] }`. `types.ts`는 `DrawingStroke`를 `./drawing`에서 re-export한다.

- [ ] **Step 1: 실패하는 스키마 테스트를 추가한다.** `workspaceDocumentSchema.safeParse`로 확인한다. 베이스 문서는 `{canvas:{width:2000,height:1200,infinite:true}, nodes:[], connections:[]}`다.
  - `drawing` 없음 → success
  - `drawing:{strokes:[]}` → success
  - 정상 선(`points:[0,0,10,10]`), 점 하나 선(`[5,5]`) → success
  - `color:"black"`, `width:3`, `points:[1,2,3]`(홀수), `points:[]`, `points:[0, Infinity]`, 같은 ID 두 선 → 각각 fail
  - 선 3,001개 → fail. 숫자 8,002개인 선 → fail.
  - 하위 캔버스 노드 문서 안의 `drawing`도 검사된다: 잘못된 색을 넣으면 fail.
  - 전체 점 한도: 루트와 하위 캔버스를 합쳐 300,001점이면 fail. 선마다 4,000점짜리를 여러 공간에 나눠 만든다.

- [ ] **Step 2: 실행해서 실패를 확인한다.**
  Run: `node --import tsx --test scripts/test-drawing.ts`
  Expected: 새 스키마 테스트 FAIL. strict 객체라 `drawing` 키가 거절되어 success 케이스도 실패한다.

- [ ] **Step 3: 타입과 스키마를 구현한다.**
  - `types.ts`: `WorkspaceDocument`에 `drawing?: { strokes: DrawingStroke[] }`를 추가한다. 주석: "공간마다 따로 저장하는 손그림. 없으면 그림 없음."
  - `workspace-schema.ts`의 `strokeSchema`:
    - `id: z.string().min(1).max(64)`
    - `color: z.enum(CONNECTION_COLOR_KEYS)`
    - `width: z.union(STROKE_WIDTHS.map(z.literal))` 또는 동등한 리터럴 유니온
    - `points: z.array(z.number().finite()).min(2).max(MAX_POINTS_PER_STROKE * 2)` + 짝수 길이 refine
  - 문서 객체에 `drawing: z.strictObject({ strokes: z.array(strokeSchema).max(MAX_STROKES_PER_CANVAS) }).optional()`을 넣는다. 선 ID 중복을 검사하는 refine(메시지 "선 ID가 중복되었습니다.")을 추가한다.
  - 루트 `superRefine`: 모든 공간의 점 수를 합산해서 `MAX_DRAWING_POINTS`를 넘으면 "프로젝트의 그림이 너무 큽니다." 이슈를 추가한다.
    - 루트 문서와, `walkWorkspaceNodes`로 찾은 `canvas_node.document`마다 `countStrokePoints(doc.drawing?.strokes ?? [])`를 센다.

- [ ] **Step 4: 전체 테스트를 실행한다.**
  Run: Global Constraints의 전체 테스트 명령
  Expected: 전부 PASS(기존 91개와 새 테스트)

- [ ] **Step 5: 커밋한다.**
  ```bash
  git add src/features/workspace/types.ts src/features/workspace/workspace-schema.ts scripts/test-drawing.ts
  git commit -m "Store per-canvas drawings in the document schema"
  ```

### Task 3: 펜·지우개 UI와 편집기 연결

**Files:**
- Create: `src/features/workspace/drawing-layer.tsx`
- Create: `src/features/workspace/draw-options.tsx`
- Modify: `src/features/workspace/icons.tsx` (`PenIcon`, `EraserIcon`)
- Modify: `src/features/workspace/workspace-toolbar.tsx`
- Modify: `src/features/workspace/workspace.tsx` (`Gesture`, `clearGesture`, `moveGesture`, `endGesture`, `handleEditorShortcut`, `Escape` 처리, 뷰포트 JSX)
- Modify: `src/features/workspace/shortcut-help.tsx` (P, E 항목)
- Modify: `scripts/test-workspace-editing.ts` (새로 참조하는 이름의 스텁)
- Create: `docs/workspace-drawing.md`

**Interfaces:**
- Consumes: Task 1 함수와 상수, Task 2의 `WorkspaceDocument.drawing`
- Produces:
  ```ts
  // drawing-layer.tsx
  export default function DrawingLayer(props: { strokes: DrawingStroke[]; draft: DrawingStroke | null }): JSX.Element
  // draw-options.tsx
  export default function DrawOptions(props: { color: ConnectionColor; width: StrokeWidth; onColor(c: ConnectionColor): void; onWidth(w: StrokeWidth): void }): JSX.Element
  // workspace-toolbar.tsx 추가 props
  tool: "select" | "pen" | "eraser"; onToolChange(tool: "select" | "pen" | "eraser"): void
  ```

- [ ] **Step 1: `scripts/test-workspace-editing.ts`의 기존 테스트가 통과하는지 확인한다.** 이후 단계에서 추출 함수가 새 이름(`tool`, `setTool`, `drawDraft` 등)을 참조하면 팩토리 스텁에 추가해야 한다. 지금 상태를 기록해 둔다.
  Run: `node --import tsx --test scripts/test-workspace-editing.ts`
  Expected: PASS

- [ ] **Step 2: 렌더링 부품을 만든다.**
  - **`DrawingLayer`:**
    - `<svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width={1} height={1}>`
    - 선마다 `<path d={strokePath(points)} stroke={connectionColor(color).value} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" />`
    - `draft`도 같은 방식으로 그린다.
    - `aria-hidden`
  - **`DrawOptions`:**
    - `role="radiogroup"` 두 개: aria-label "펜 색", "펜 굵기"
    - 색 스와치는 8개, 굵기는 원 크기가 다른 3개(라벨 "가늘게", "보통", "굵게")
    - `aria-checked`, 화살표 키 이동
    - 위치는 도구 막대 오른쪽(`left-[76px]`)이고, 스타일은 `shadow-float` 흰 카드
    - 펜 모드일 때만 렌더링한다.
  - **아이콘:** `icons.tsx`에 `PenIcon`(대각선 펜촉)과 `EraserIcon`(기울어진 지우개 + 바닥선)을 같은 1.8 굵기로 추가한다.
  - **`WorkspaceToolbar`:** 노드 그룹 아래에 `h-px bg-rule` 구분선을 두고 `role="group" aria-label="그리기 도구"`로 버튼 2개를 넣는다.
    - `aria-pressed={tool === "pen"}`, title은 "펜 (P)", "지우개 (E)"다.
    - 켜진 상태는 `bg-moss-wash text-ink`로 표시한다.
    - 클릭하면 `onToolChange(tool === x ? "select" : x)`를 부른다.

- [ ] **Step 3: `workspace.tsx`에 상태와 단축키를 연결한다.**
  - `const [tool, setTool] = useState<"select" | "pen" | "eraser">("select")`
  - `penColor`, `penWidth` 상태:
    - 초기값은 기본값(`lichen`, `4`)이다.
    - 마운트 후 localStorage `nono:pen`(JSON `{color,width}`)을 읽어 검증한 뒤 반영한다. 반영은 effect가 아니라 lazy initializer로 한다. SSR이면 기본값을 쓴다. 린트 `set-state-in-effect`를 피하기 위해서다.
    - 바꿀 때 저장한다. 읽기와 쓰기 모두 try/catch로 감싼다.
  - `handleEditorShortcut`:
    - 수정키 없는 `p` → `setTool(t => t === "pen" ? "select" : "pen")`
    - `e` → 지우개도 같은 방식이다.
    - 입력칸 안에서는 이미 이 핸들러가 불리지 않는다. 기존 t/i/c/l 경로와 같은 위치에 넣는다.
  - `Escape` 처리(783행 근처): `tool !== "select"`면 `setTool("select")`하고 return한다. 기존 Esc 동작보다 먼저 처리한다.
  - `tool !== "select"`로 바뀌면 노드 선택과 연결선 선택을 해제한다(`changeTool` 함수 안에서 처리하고 effect는 쓰지 않는다).

- [ ] **Step 4: 제스처를 구현한다.**
  - **`Gesture` 유니온에 추가:**
    - `{ kind: "draw"; pointerId; startPointer: Point; points: number[]; zoom: number }`
    - `{ kind: "erase"; pointerId; startPointer: Point; last: Point; zoom: number }`
  - **입력 판:** `tool !== "select"`일 때 캔버스 변환 div **밖**, 뷰포트 안에 `<div data-draw-surface className="absolute inset-0 z-30" />`를 둔다. 노드보다 위, 도구 막대(z-35)보다 아래다. 판이 노드 위를 덮으므로 노드 이벤트가 막힌다. 뷰포트의 `onPointerDown`에서 `startMarquee`보다 먼저 `startDrawing`을 부른다. 핸들러는 `tool === "select" ? startMarquee : startDrawing`이다. `startPan`(capture)이 먼저 처리하므로 스페이스·휠 클릭 이동은 유지된다.
  - **`startDrawing(event)`:**
    - 공통: `event.button !== 0`이거나 `gestureRef.current`가 있으면 return한다. `getCanvasPoint`로 캔버스 좌표를 구한다.
    - **pen:**
      - `strokes.length >= MAX_STROKES_PER_CANVAS`거나 루트 전체 점 수가 `MAX_DRAWING_POINTS` 이상이면 알림 `"그림은 한 공간에 선 3,000개, 프로젝트 전체에 점 30만 개까지 그릴 수 있어요."`를 띄우고 return한다.
      - 그렇지 않으면 포인터를 캡처하고 `gesture = {kind:"draw", points: appendPoint([], x, y, 0)}`로 시작한다. `setDrawDraft`도 설정한다.
    - **eraser:** `dispatchHistory({type:"begin"})`을 부르고 erase 제스처를 시작한다. 시작점 하나로 `eraseAt([x,y])`를 즉시 적용한다.
  - **`moveGesture`:**
    - **draw:** `gesture.points = appendPoint(gesture.points, x, y, 1.5 / gesture.zoom)`. 배열이 바뀌었을 때만 `setDrawDraft`를 갱신한다.
    - **erase:** `eraseAt([last.x, last.y, x, y])` 후 `last`를 갱신한다.
    - **`eraseAt(eraser)`:** `setWorkspace(doc => …)`. 다음 순서로 처리한다.
      - `strokes`가 없으면 doc을 그대로 둔다.
      - `next = eraseStrokes(strokes, eraser, 10 / zoom, uuidv4)`
      - `next === strokes`면 doc을 그대로 둔다.
      - `next.length > MAX_STROKES_PER_CANVAS`면 doc을 그대로 두고 알림을 1회 띄운다(Review Focus 1).
      - 그 밖에는 `{...doc, drawing:{strokes: next}}`를 돌려준다.
    - `buttonMask` 검사는 기존대로 1이다.
  - **`clearGesture`:**
    - erase 제스처면 `dispatchHistory({type:"commit"})`을 부른다. 아무것도 지우지 못했으면 기존 `commitTransaction`이 빈 단계를 만들지 않는다.
    - draw 제스처면 `finishStroke(gesture)`를 부른다.
    - `setDrawDraft(null)`
    - pointerup, cancel, lost capture, window blur 모두 이 경로를 탄다.
  - **`finishStroke`:**
    - `points = simplifyPoints(gesture.points, 0.5 / gesture.zoom)`
    - 단일 `setWorkspace` change(Undo 한 단계)로 `{id: uuidv4(), color: penColor, width: penWidth, points}`를 `strokes` 끝에 붙인다.
    - 붙이기 직전에 한도를 다시 확인한다. 넘으면 버리고 알림을 띄운다.
  - **하위 캔버스 이동:** `canvasPath`가 바뀌는 경로(기존 공간 이동 함수)에서 이미 `clearGesture`를 부르는지 확인한다. 부르지 않으면 이동 전에 부른다(Review Focus 4). `setWorkspace`는 `canvasPath`에 묶인 콜백이므로 이동 전에 확정해야 원래 공간에 저장된다.
  - **커서:**
    - pen이면 `crosshair`다.
    - eraser이면 `none`이다. 대신 `eraserPointer` 상태로 `left/top`을 잡아 지름 20px, `border-bark-soft/60` 원(`pointer-events-none fixed`)을 그린다. 포인터가 뷰포트를 떠나면 숨긴다.
    - 패닝 중이면 기존 커서 규칙이 우선한다.
  - **렌더링:** 캔버스 변환 div 안, `ConnectionLayer` 바로 앞에 `<DrawingLayer strokes={workspace.drawing?.strokes ?? []} draft={drawDraft} />`를 둔다. `drawDraft`는 `DrawingStroke | null` 상태이고, 그리는 중인 선에 `penColor`와 `penWidth`를 붙여 만든다.
  - **도구 막대:** `<DrawOptions …/>`는 `tool === "pen"`일 때 렌더링한다. `WorkspaceToolbar`에 `tool`과 `onToolChange={changeTool}`를 넘긴다.
  - `shortcut-help.tsx`에 "펜 P", "지우개 E", "그리기 끝내기 Esc"를 추가한다.

- [ ] **Step 5: 검사를 실행한다.**
  - 타입 검사: `node node_modules/typescript/bin/tsc --noEmit` → 오류 0
  - 린트: `npx eslint src scripts` → 오류 0
  - 테스트: Global Constraints의 전체 테스트 명령 → 전부 PASS
  - `test-workspace-editing.ts`가 `ReferenceError`로 실패하면 새로 참조하는 이름(`tool`, `setTool`, `startDrawing`, `finishStroke`, `setDrawDraft` 등)을 팩토리 스텁에 추가한다.

- [ ] **Step 6: 브라우저에서 확인한다.**
  - dev 서버는 `next dev -p 3001`로 띄운다. 3000번은 사용자 서버이므로 건드리지 않는다.
  - 테스트 계정은 `ui-check-…@example.com`이다.
  - 확인 항목:
    - P로 펜을 켜고 색과 굵기를 바꿔 노드 위·밖으로 선을 긋는다. 노드 위로 지나간 부분은 노드에 가려진다.
    - 클릭만 하면 점이 남는다.
    - E로 지우개를 켜고 선 가운데를 문질러 둘로 나뉘는지 본다.
    - Ctrl+Z / Ctrl+Y로 한 단계씩 되돌리고 다시 실행한다.
    - 펜 모드에서 스페이스 드래그와 휠 클릭으로 이동하고, 휠로 확대·축소한다.
    - Esc로 선택 모드에 돌아오면 노드 드래그가 정상이다.
    - 저장 상태가 표시된 뒤 새로고침하면 그림이 유지된다.
    - 하위 캔버스에 들어가 따로 그리고 나와서 두 공간의 그림이 섞이지 않는다.
  - 콘솔 오류가 없어야 한다. 끝나면 dev 서버를 끄고 테스트 계정을 정리한다.

- [ ] **Step 7: 문서를 쓰고 커밋한다.**
  - `docs/workspace-drawing.md`를 기존 docs 형식(한국어)으로 쓴다.
    - 데이터 구조, 한도, 지우개 알고리즘 요약, 되돌리기 단위
    - 알려진 한계: 펜 모드 중 노드 조작 불가, 대시보드 미리보기에 그림 없음, 지우개 경계는 반지름/2 간격으로 잘림
  - 바꾼 파일에만 Prettier를 돌린다.
  ```bash
  git add src/features/workspace/drawing-layer.tsx src/features/workspace/draw-options.tsx src/features/workspace/icons.tsx src/features/workspace/workspace-toolbar.tsx src/features/workspace/workspace.tsx src/features/workspace/shortcut-help.tsx scripts/test-workspace-editing.ts docs/workspace-drawing.md
  git commit -m "Add pen and eraser tools to the canvas"
  ```
  - `workspace.tsx`에는 이 작업 전부터 있던 미커밋 변경(빈 작업 공간 메시지 제거)이 섞여 있다. 커밋 전에 사용자에게 함께 커밋할지 확인한다.
