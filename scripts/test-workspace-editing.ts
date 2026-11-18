import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import {
  createWorkspaceHistory,
  workspaceHistoryReducer,
  type WorkspaceHistory,
} from "../src/features/workspace/workspace-history";
import type {
  ConnectionEndpoint,
  Point,
  WorkspaceDocument,
} from "../src/features/workspace/types";
import {
  CONNECTION_SIDES,
  CONNECTION_SNAP_RADIUS,
  MAX_CONNECTIONS,
  appendConnectedNode,
  connectSourcesToTarget,
  facingSide,
  positionForPort,
  findConnectionTarget,
  getConnectionKey,
  getConnectionPath,
  getConnectionPoint,
} from "../src/features/workspace/connections";
import { workspaceDocumentSchema } from "../src/features/workspace/workspace-schema";
import {
  fitNodeSize,
  replaceNodeImage,
} from "../src/features/workspace/node-transform";
import * as drawing from "../src/features/workspace/drawing";
import * as groupOps from "../src/features/workspace/groups";
import {
  resolveWorkspacePath,
  updateWorkspaceAtPath,
} from "../src/features/workspace/workspace-tree";

function fixture(): WorkspaceDocument {
  return {
    canvas: { width: 2000, height: 1200 },
    connections: [],
    nodes: [
      {
        id: "a",
        type: "text_node",
        position: { x: 100, y: 100 },
        width: 320,
        height: 220,
        title: "A",
        text: "본문",
      },
      {
        id: "b",
        type: "text_node",
        position: { x: 600, y: 400 },
        width: 200,
        height: 140,
        title: "B",
        text: "",
      },
      {
        id: "c",
        type: "text_node",
        position: { x: 1200, y: 700 },
        width: 250,
        height: 180,
        title: "C",
        text: "",
      },
    ],
  };
}

function rename(state: WorkspaceHistory, title: string) {
  return workspaceHistoryReducer(state, {
    type: "change",
    update: (document) => ({
      ...document,
      nodes: document.nodes.map((node, index) =>
        index === 0 ? { ...node, title } : node,
      ),
    }),
  });
}

test("수정·실행 취소·다시 실행은 문서 스냅샷을 복원한다", () => {
  const document = fixture();
  const changed = rename(createWorkspaceHistory(document), "수정");
  const undone = workspaceHistoryReducer(changed, { type: "undo" });
  assert.equal(undone.present, document);
  assert.equal(
    workspaceHistoryReducer(undone, { type: "redo" }).present,
    changed.present,
  );
});

test("수백 번의 미리보기 변경도 트랜잭션 하나로 기록한다", () => {
  let state = workspaceHistoryReducer(createWorkspaceHistory(fixture()), {
    type: "begin",
  });
  for (let i = 0; i < 300; i++) state = rename(state, String(i));
  assert.equal(state.past.length, 0);
  state = workspaceHistoryReducer(state, { type: "commit" });
  assert.equal(state.past.length, 1);
  assert.equal(
    workspaceHistoryReducer(state, { type: "undo" }).present.nodes[0].title,
    "A",
  );
});

test("제자리로 돌아온 드래그는 저장 기준 참조와 다시 실행을 유지한다", () => {
  const document = fixture();
  let state = workspaceHistoryReducer(
    rename(createWorkspaceHistory(document), "새 제목"),
    { type: "undo" },
  );
  state = workspaceHistoryReducer(state, { type: "begin" });
  state = rename(state, "미리보기");
  state = rename(state, "A");
  state = workspaceHistoryReducer(state, { type: "commit" });
  assert.equal(state.present, document);
  assert.equal(state.past.length, 0);
  assert.equal(state.future.length, 1);
});

test("Escape 취소는 이전 문서와 다시 실행 이력을 보존한다", () => {
  let state = workspaceHistoryReducer(
    rename(createWorkspaceHistory(fixture()), "새 제목"),
    { type: "undo" },
  );
  const document = state.present;
  state = workspaceHistoryReducer(state, { type: "begin" });
  state = rename(state, "취소할 내용");
  state = workspaceHistoryReducer(state, { type: "cancel" });
  assert.equal(state.present, document);
  assert.equal(state.past.length, 0);
  assert.equal(state.future.length, 1);
});

test("실행 취소 뒤 새 편집은 이전 다시 실행 분기를 제거한다", () => {
  let state = workspaceHistoryReducer(
    rename(createWorkspaceHistory(fixture()), "이전 분기"),
    { type: "undo" },
  );
  state = rename(state, "새 분기");
  assert.equal(state.future.length, 0);
  assert.equal(workspaceHistoryReducer(state, { type: "redo" }), state);
});

test("진행 중인 편집에서 다음 작업을 시작해도 이전 작업을 잃지 않는다", () => {
  let state = workspaceHistoryReducer(createWorkspaceHistory(fixture()), {
    type: "begin",
  });
  state = rename(state, "텍스트 편집");
  state = workspaceHistoryReducer(state, { type: "begin" });
  state = rename(state, "다음 작업");
  state = workspaceHistoryReducer(state, { type: "commit" });
  assert.equal(state.past.length, 2);
  assert.equal(
    workspaceHistoryReducer(state, { type: "undo" }).present.nodes[0].title,
    "텍스트 편집",
  );
});

test("이력은 최근 100단계로 제한한다", () => {
  let state = createWorkspaceHistory(fixture());
  for (let i = 0; i < 120; i++) state = rename(state, String(i));
  assert.equal(state.past.length, 100);
  for (let i = 0; i < 110; i++)
    state = workspaceHistoryReducer(state, { type: "undo" });
  assert.equal(state.past.length, 0);
  assert.equal(state.future.length, 100);
  assert.equal(state.present.nodes[0].title, "19");
});

// UI 코드를 테스트용으로 다시 작성하지 않고 실제 이벤트 함수들을 실행한다.
const source = readFileSync(
  new URL("../src/features/workspace/workspace.tsx", import.meta.url),
  "utf8",
);
const tree = ts.createSourceFile(
  "workspace.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const names = [
  "selectNode",
  "selectConnection",
  "startMarquee",
  "beginTextEdit",
  "endTextEdit",
  "undo",
  "redo",
  "handleWorkspaceKeyDown",
  "handleEditorShortcut",
  "nudgeSelection",
  "startNodeDrag",
  "startNodeResize",
  "moveGesture",
  "endGesture",
  "updateTextNode",
  "deleteSelection",
  "getCanvasPoint",
  "getConnectionHover",
  "startNodeConnection",
  "startPan",
  "startDrawing",
  "eraseAlong",
  "pickSearchResult",
  "focusNodeById",
  "beginNodeGesture",
  "startGroupDrag",
  "groupSelection",
  "ungroupSelection",
  "openNodeMenuForSelection",
  "openNodeMenuAt",
  "applyDocumentChange",
  "openTagLens",
];
const functions = new Map<string, string>();
let clearGesture = "";
function visit(node: ts.Node) {
  if (
    ts.isFunctionDeclaration(node) &&
    node.name &&
    names.includes(node.name.text)
  )
    functions.set(node.name.text, node.getText(tree));
  if (
    ts.isVariableDeclaration(node) &&
    node.name.getText(tree) === "clearGesture" &&
    node.initializer &&
    ts.isCallExpression(node.initializer)
  ) {
    clearGesture = `const clearGesture = ${node.initializer.arguments[0].getText(tree)};`;
  }
  ts.forEachChild(node, visit);
}
visit(tree);
assert.equal(functions.size, names.length);
assert.ok(clearGesture);
const compiled = ts.transpileModule(
  [clearGesture, ...functions.values()].join("\n"),
  { compilerOptions: { target: ts.ScriptTarget.ES2017 } },
).outputText;

class TestElement {
  constructor(
    private editable = false,
    private node = false,
    public dataset: { nodeId?: string; connectionSide?: string } = {},
  ) {}
  closest(selector: string) {
    if (selector === "[data-connection-side]") {
      return this.dataset.connectionSide ? this : null;
    }
    return (selector.includes("[data-node-id]") ? this.node : this.editable)
      ? this
      : null;
  }
}

type TestState = {
  history: WorkspaceHistory;
  selected: string[];
  selectedConnection: string | null;
  camera: { x: number; y: number; zoom: number };
  rect: unknown;
  panning: boolean;
  captured: boolean;
  focusCount: number;
  draft: {
    source: ConnectionEndpoint;
    pointer: Point;
    hoveredNodeId: string | null;
    target: ConnectionEndpoint | null;
    others?: ConnectionEndpoint[];
  } | null;
  connectMenu?: {
    left: number;
    top: number;
    point: Point;
    source: ConnectionEndpoint;
    others: ConnectionEndpoint[];
  } | null;
  hoveredElement: TestElement | null;
  calls: string[];
  spaceHeld?: boolean;
  tool?: "select" | "pen" | "eraser";
  canvasPath?: string[];
  searchActive?: number | null;
  joinTarget?: string | null;
  nodeMenu?: { left: number; top: number } | null;
  searchOpen?: boolean;
  searchQuery?: string;
  debouncedQuery?: string;
  pendingFocus?: { key: string; nodeId: string } | null;
};
type Handlers = Record<string, (...args: unknown[]) => void>;
const factory = new Function(
  "state",
  "viewportRef",
  "gestureRef",
  "workspaceHistoryReducer",
  "Element",
  "document",
  "uuidv4",
  "findConnectionTarget",
  "MAX_CONNECTIONS",
  "getConnectionPoint",
  "getConnectionKey",
  "fitNodeSize",
  "replaceNodeImage",
  "resolveWorkspacePath",
  "updateWorkspaceAtPath",
  "drawing",
  "connectSourcesToTarget",
  "groupOps",
  `
  const { canJoinByDrag, groupAtPoint, joinGroup, groupNodes, ungroupNodes, renameGroup } = groupOps;
  const setNodeMenu = value => { state.nodeMenu = value; };
  const { appendPoint, appendStroke, countDocumentDrawingPoints, eraseStrokes,
    exceedsDrawingLimits, simplifyPoints, MAX_DRAWING_POINTS, MAX_STROKES_PER_CANVAS } = drawing;
  const ERASER_RADIUS = 10;
  const DRAW_MIN_DISTANCE = 1.5;
  const DRAWING_LIMIT_NOTICE = "limit";
  const canvasPath = state.canvasPath ?? [];
  const activeDepth = canvasPath.length;
  const rootDocument = state.history.present;
  const rootDocumentRef = { get current() { return state.history.present; } };
  const workspace = resolveWorkspacePath(state.history.present, canvasPath).document;
  const selectedNodeIds = state.selected;
  const selectedConnectionId = state.selectedConnection;
  const camera = state.camera;
  const pendingImagesRef = { current: [] };
  const dispatchHistory = action => { state.history = workspaceHistoryReducer(state.history, action); };
  const setWorkspace = update => dispatchHistory({ type: "change", update: root => updateWorkspaceAtPath(root, canvasPath, update) });
  const setSelectedNodeIds = update => { state.selected = typeof update === "function" ? update(state.selected) : update; };
  const setSelectedConnectionId = value => { state.selectedConnection = value; };
  const setCamera = update => { state.camera = update(state.camera); };
  const setSelectionRect = rect => { state.rect = rect; };
  const setConnectionDraft = draft => { state.draft = draft; };
  const setIsPanning = value => { state.panning = value; };
  // 단축키가 부르는 화면 밖 동작은 호출 기록만 남긴다.
  const NUDGE_STEP = 8;
  const NUDGE_STEP_LARGE = 40;
  const CONNECT_MENU_MIN_DRAG = 8;
  const saveWorkspace = async () => { state.calls.push("save"); };
  const openSearch = () => { state.calls.push("search"); };
  const canvasKey = canvasPath.slice(0, activeDepth).join("/");
  const pendingFocusRef = {
    get current() { return state.pendingFocus ?? null; },
    set current(value) { state.pendingFocus = value; },
  };
  const setSearchActive = value => { state.searchActive = value; };
  const setConnectMenu = value => { state.connectMenu = value; };
  const setJoinTargetId = value => { state.joinTarget = value; };
  const setSearchOpen = value => { state.searchOpen = value; };
  const setSearchQuery = value => { state.searchQuery = value; };
  const setDebouncedQuery = value => { state.debouncedQuery = value; };
  const searchInputRef = { current: { focus() { state.calls.push("focus-search"); } } };
  const navigateCanvas = () => { state.calls.push("navigate"); };
  const addNode = type => { state.calls.push("add:" + type); return null; };
  const chooseImage = () => {};
  const zoomBy = factor => { state.calls.push("zoom:" + factor); };
  const fitCanvas = () => { state.calls.push("fit"); };
  const duplicateSelection = () => { state.calls.push("duplicate"); };
  // 그리기 도구는 선택 모드로 시작한다. 도구 전환은 호출 기록만 남긴다.
  const tool = state.tool ?? "select";
  const pen = { color: "teal", width: 4 };
  const setEraserPointer = () => {};
  const changeTool = next => { state.calls.push("tool:" + next); };
  const setDrawDraft = () => {};
  const spaceHeldRef = { current: state.spaceHeld };
  const setNotice = message => { state.calls.push("notice:" + message); };
  ${compiled}
  return { ${names.join(", ")}, clearGesture };
`,
) as (...args: unknown[]) => Handlers;

function setup(selected: string[] = []) {
  const state: TestState = {
    history: createWorkspaceHistory(fixture()),
    selected,
    selectedConnection: null,
    camera: { x: 10, y: 20, zoom: 0.5 },
    rect: null,
    panning: false,
    captured: false,
    focusCount: 0,
    draft: null,
    hoveredElement: null,
    calls: [],
  };
  const gestureRef: { current: unknown } = { current: null };
  const viewport = {
    focus() {
      state.focusCount++;
    },
    getBoundingClientRect: () => ({
      left: 10,
      top: 20,
      width: 1000,
      height: 700,
    }),
    setPointerCapture() {
      state.captured = true;
    },
    hasPointerCapture: () => state.captured,
    releasePointerCapture() {
      state.captured = false;
    },
  };
  return {
    state,
    gestureRef,
    call(name: string, ...args: unknown[]) {
      factory(
        state,
        { current: viewport },
        gestureRef,
        workspaceHistoryReducer,
        TestElement,
        { elementFromPoint: () => state.hoveredElement },
        randomUUID,
        findConnectionTarget,
        MAX_CONNECTIONS,
        getConnectionPoint,
        getConnectionKey,
        fitNodeSize,
        replaceNodeImage,
        resolveWorkspacePath,
        updateWorkspaceAtPath,
        drawing,
        connectSourcesToTarget,
        groupOps,
      )[name](...args);
    },
  };
}

function pointer(extra: Record<string, unknown> = {}) {
  return {
    button: 0,
    buttons: 1,
    pointerId: 1,
    clientX: 20,
    clientY: 40,
    shiftKey: false,
    target: new TestElement(),
    preventDefault() {},
    stopPropagation() {},
    ...extra,
  };
}

function key(value: string, extra: Record<string, unknown> = {}) {
  return {
    key: value,
    defaultPrevented: false,
    nativeEvent: { isComposing: false },
    keyCode: 0,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: new TestElement(),
    preventDefault() {
      this.defaultPrevented = true;
    },
    ...extra,
  };
}

test("양방향 박스 선택은 카메라 좌표를 환산하고 문서를 변경하지 않는다", () => {
  for (const reverse of [false, true]) {
    const h = setup();
    const document = h.state.history.present;
    h.call(
      "startMarquee",
      pointer(reverse ? { clientX: 450, clientY: 350 } : {}),
    );
    h.call(
      "moveGesture",
      pointer(reverse ? {} : { clientX: 450, clientY: 350 }),
    );
    assert.deepEqual(h.state.selected, ["a", "b"]);
    assert.equal(h.state.history.present, document);
    h.call("endGesture", pointer({ buttons: 0 }));
    assert.equal(h.state.rect, null);
    assert.equal(h.state.history.past.length, 0);
    assert.equal(h.state.captured, false);
  }
});

test("네 방향 연결점과 곡선은 노드의 현재 좌표·크기에서 계산한다", () => {
  const [node, target] = fixture().nodes;
  assert.deepEqual(getConnectionPoint(node, "top"), { x: 260, y: 100 });
  assert.deepEqual(getConnectionPoint(node, "right"), { x: 420, y: 210 });
  assert.deepEqual(getConnectionPoint(node, "bottom"), { x: 260, y: 320 });
  assert.deepEqual(getConnectionPoint(node, "left"), { x: 100, y: 210 });
  for (const side of CONNECTION_SIDES) {
    for (const targetSide of CONNECTION_SIDES) {
      const start = getConnectionPoint(node, side);
      const end = getConnectionPoint(target, targetSide);
      const path = getConnectionPath(start, end, side, targetSide);
      assert.ok(path.startsWith(`M ${start.x} ${start.y} C `));
      assert.ok(path.endsWith(`${end.x} ${end.y}`));
      assert.ok(!path.includes("NaN"));
    }
  }
});

test("스냅 범위 밖에서는 커서 좌표를 유지하고 연결하지 않는다", () => {
  const h = setup();
  const document = h.state.history.present;
  h.call("startNodeConnection", pointer(), document.nodes[0], "right");
  h.state.hoveredElement = new TestElement(false, true, { nodeId: "b" });
  h.call("moveGesture", pointer({ clientX: 290, clientY: 275 }));
  assert.deepEqual(h.state.draft?.pointer, { x: 540, y: 470 });
  assert.equal(h.state.draft?.hoveredNodeId, "b");
  assert.equal(h.state.draft?.target, null);
  assert.equal(h.state.history.present, document);
  h.call(
    "endGesture",
    pointer({ type: "pointerup", buttons: 0, clientX: 290, clientY: 275 }),
  );
  assert.equal(h.state.history.present, document);
  assert.equal(h.state.history.past.length, 0);
  assert.equal(h.state.draft, null);
});

test("점 근처에서 미리보기가 스냅되고 한 단계로 연결·실행 취소·복원한다", () => {
  const h = setup();
  const document = h.state.history.present;
  h.call("startNodeConnection", pointer(), document.nodes[0], "right");
  h.state.hoveredElement = new TestElement(false, true, {
    nodeId: "b",
    connectionSide: "left",
  });
  h.call("moveGesture", pointer({ clientX: 310, clientY: 269 }));
  assert.deepEqual(h.state.draft?.target, { nodeId: "b", side: "left" });
  assert.deepEqual(h.state.draft?.pointer, { x: 600, y: 470 });
  assert.equal(h.state.history.present.connections.length, 0);
  h.call(
    "endGesture",
    pointer({ type: "pointerup", buttons: 0, clientX: 310, clientY: 269 }),
  );
  const [connection] = h.state.history.present.connections;
  assert.deepEqual(connection.source, { nodeId: "a", side: "right" });
  assert.deepEqual(connection.target, { nodeId: "b", side: "left" });
  assert.equal(h.state.history.past.length, 1);
  h.call("undo");
  assert.equal(h.state.history.present, document);
  h.call("redo");
  assert.equal(h.state.history.present.connections[0], connection);
});

test("connectSourcesToTarget는 자기 자신·중복·한도 초과 몫을 건너뛴다", () => {
  const target = { nodeId: "b", side: "left" } as const;
  const existing = [
    { id: "x", source: { nodeId: "c", side: "right" as const }, target },
  ];
  const sources = (["a", "b", "c"] as const).map((nodeId) => ({
    nodeId,
    side: "right" as const,
  }));
  let n = 0;
  const makeId = () => `new-${++n}`;
  const result = connectSourcesToTarget(
    existing,
    new Set(["a", "b", "c"]),
    sources,
    target,
    makeId,
  );
  assert.deepEqual(result.added, [
    { id: "new-1", source: { nodeId: "a", side: "right" }, target },
  ]);
  assert.equal(result.skippedForLimit, 0);

  // 한도가 하나만 남으면 첫 몫만 잇고 나머지는 한도 때문에 건너뛴다.
  const limited = connectSourcesToTarget(
    [],
    new Set(["a", "b", "c"]),
    sources,
    target,
    makeId,
    1,
  );
  assert.deepEqual(
    limited.added.map((connection) => connection.source.nodeId),
    ["a"],
  );
  assert.equal(limited.skippedForLimit, 1);
});

test("다중 선택에서 연결점을 끌면 선택한 노드 모두가 같은 변에서 한 단계로 연결된다", () => {
  const h = setup(["a", "c"]);
  const document = h.state.history.present;
  h.call("startNodeConnection", pointer(), document.nodes[0], "right");
  assert.deepEqual(h.state.selected, ["a", "c"]);
  assert.deepEqual(h.state.draft?.others, [{ nodeId: "c", side: "right" }]);
  h.state.hoveredElement = new TestElement(false, true, {
    nodeId: "b",
    connectionSide: "left",
  });
  h.call("moveGesture", pointer({ clientX: 310, clientY: 269 }));
  assert.deepEqual(h.state.draft?.others, [{ nodeId: "c", side: "right" }]);
  h.call(
    "endGesture",
    pointer({ type: "pointerup", buttons: 0, clientX: 310, clientY: 269 }),
  );
  assert.deepEqual(
    h.state.history.present.connections.map((connection) => [
      connection.source,
      connection.target,
    ]),
    [
      [
        { nodeId: "a", side: "right" },
        { nodeId: "b", side: "left" },
      ],
      [
        { nodeId: "c", side: "right" },
        { nodeId: "b", side: "left" },
      ],
    ],
  );
  assert.equal(h.state.history.past.length, 1);
  assert.deepEqual(h.state.selected, ["a", "c"]);
  h.call("undo");
  assert.equal(h.state.history.present, document);
});

test("다중 연결: 대상이 선택 안에 있으면 그 노드는 건너뛰고, 선택 밖 노드를 잡으면 하나만 잇는다", () => {
  const h = setup(["a", "b"]);
  const document = h.state.history.present;
  h.call("startNodeConnection", pointer(), document.nodes[0], "right");
  h.state.hoveredElement = new TestElement(false, true, {
    nodeId: "b",
    connectionSide: "left",
  });
  h.call(
    "endGesture",
    pointer({ type: "pointerup", buttons: 0, clientX: 310, clientY: 269 }),
  );
  assert.deepEqual(
    h.state.history.present.connections.map((c) => c.source.nodeId),
    ["a"],
  );

  const single = setup(["b", "c"]);
  single.call(
    "startNodeConnection",
    pointer(),
    single.state.history.present.nodes[0],
    "right",
  );
  assert.deepEqual(single.state.selected, ["a"]);
  assert.equal(single.state.draft?.others, undefined);
});

test("facingSide는 가로·세로 중 더 먼 쪽으로 새 노드가 시작점을 바라보는 변을 고른다", () => {
  const from = { x: 100, y: 100 };
  assert.equal(facingSide(from, { x: 300, y: 150 }), "left");
  assert.equal(facingSide(from, { x: -100, y: 60 }), "right");
  assert.equal(facingSide(from, { x: 120, y: 400 }), "top");
  assert.equal(facingSide(from, { x: 80, y: -200 }), "bottom");
  // 같은 거리면 가로를 따른다.
  assert.equal(facingSide(from, { x: 200, y: 200 }), "left");
});

test("positionForPort는 그 변의 연결점이 놓은 자리에 오도록 왼쪽 위를 정한다", () => {
  const anchor = { x: 500, y: 300 };
  assert.deepEqual(positionForPort(anchor, "left", 320, 220), {
    x: 500,
    y: 190,
  });
  assert.deepEqual(positionForPort(anchor, "right", 320, 220), {
    x: 180,
    y: 190,
  });
  assert.deepEqual(positionForPort(anchor, "top", 320, 220), {
    x: 340,
    y: 300,
  });
  assert.deepEqual(positionForPort(anchor, "bottom", 320, 220), {
    x: 340,
    y: 80,
  });
});

test("appendConnectedNode는 노드와 선을 한 번에 넣고 대상 변으로 잇는다", () => {
  const document = fixture();
  const node = {
    ...document.nodes[1],
    id: "new",
    position: { x: 900, y: 100 },
  };
  const result = appendConnectedNode(
    document,
    node,
    [
      { nodeId: "a", side: "right" },
      { nodeId: "c", side: "right" },
    ],
    "left",
    () => "line",
  );
  assert.equal(result.document.nodes.at(-1), node);
  assert.deepEqual(
    result.document.connections.map((c) => [c.source.nodeId, c.target]),
    [
      ["a", { nodeId: "new", side: "left" }],
      ["c", { nodeId: "new", side: "left" }],
    ],
  );
  assert.equal(result.skippedForLimit, 0);
  assert.equal(document.nodes.length, 3);
});

test("연결선을 빈 곳에 놓으면 노드 종류 메뉴가 열리고 문서는 그대로다", () => {
  const h = setup();
  const document = h.state.history.present;
  h.call("startNodeConnection", pointer(), document.nodes[0], "right");
  h.state.hoveredElement = new TestElement(false, true);
  h.call(
    "endGesture",
    pointer({ type: "pointerup", buttons: 0, clientX: 400, clientY: 120 }),
  );
  assert.equal(h.state.history.present, document);
  assert.equal(h.state.history.past.length, 0);
  assert.deepEqual(h.state.connectMenu, {
    left: 390,
    top: 100,
    point: { x: 760, y: 160 },
    source: { nodeId: "a", side: "right" },
    others: [],
  });
  // 메뉴가 떠 있는 동안 놓은 자리까지 미리보기를 남긴다.
  assert.deepEqual(h.state.draft?.pointer, { x: 760, y: 160 });
  assert.equal(h.state.draft?.target, null);
});

test("거의 끌지 않았거나 노드 위에 놓으면 메뉴를 열지 않는다", () => {
  const h = setup();
  const document = h.state.history.present;
  h.call("startNodeConnection", pointer(), document.nodes[0], "right");
  h.state.hoveredElement = new TestElement(false, true);
  h.call(
    "endGesture",
    pointer({ type: "pointerup", buttons: 0, clientX: 23, clientY: 42 }),
  );
  assert.equal(h.state.connectMenu ?? null, null);

  h.call("startNodeConnection", pointer(), document.nodes[0], "right");
  h.state.hoveredElement = new TestElement(false, true, { nodeId: "c" });
  h.call(
    "endGesture",
    pointer({ type: "pointerup", buttons: 0, clientX: 400, clientY: 120 }),
  );
  assert.equal(h.state.connectMenu ?? null, null);
  assert.equal(h.state.draft, null);
});

test("Escape·포인터 취소·캡처 해제·창 전환은 연결을 만들지 않는다", () => {
  for (const action of [
    "Escape",
    "pointercancel",
    "lostpointercapture",
    "blur",
  ]) {
    const h = setup();
    const document = h.state.history.present;
    h.call("startNodeConnection", pointer(), document.nodes[0], "right");
    h.state.hoveredElement = new TestElement(false, true, {
      nodeId: "b",
      connectionSide: "left",
    });
    if (action === "Escape") h.call("handleWorkspaceKeyDown", key("Escape"));
    else if (action === "blur") h.call("clearGesture");
    else
      h.call(
        "endGesture",
        pointer({ type: action, buttons: 0, clientX: 320, clientY: 275 }),
      );
    assert.equal(h.state.history.present, document);
    assert.equal(h.state.history.past.length, 0);
    assert.equal(h.state.draft, null);
    assert.equal(h.state.captured, false);
  }
});

test("자기 노드와 연결하거나 같은 두 점을 중복 연결하지 않는다", () => {
  const h = setup();
  h.call(
    "startNodeConnection",
    pointer(),
    h.state.history.present.nodes[0],
    "right",
  );
  h.state.hoveredElement = new TestElement(false, true, {
    nodeId: "a",
    connectionSide: "top",
  });
  h.call(
    "endGesture",
    pointer({ type: "pointerup", buttons: 0, clientX: 230, clientY: 145 }),
  );
  assert.equal(h.state.history.present.connections.length, 0);

  for (let i = 0; i < 2; i++) {
    h.call(
      "startNodeConnection",
      pointer(),
      h.state.history.present.nodes[0],
      "right",
    );
    h.state.hoveredElement = new TestElement(false, true, {
      nodeId: "b",
      connectionSide: "left",
    });
    h.call(
      "endGesture",
      pointer({ type: "pointerup", buttons: 0, clientX: 320, clientY: 275 }),
    );
  }
  const document = h.state.history.present;
  h.call("startNodeConnection", pointer(), document.nodes[1], "left");
  h.state.hoveredElement = new TestElement(false, true, {
    nodeId: "a",
    connectionSide: "right",
  });
  h.call(
    "endGesture",
    pointer({ type: "pointerup", buttons: 0, clientX: 230, clientY: 145 }),
  );
  assert.equal(h.state.history.present, document);
  assert.equal(document.connections.length, 1);
  assert.equal(h.state.history.past.length, 1);
});

test("연결된 노드를 삭제하면 관련 연결도 정리되고 함께 복원된다", () => {
  const h = setup();
  h.call(
    "startNodeConnection",
    pointer(),
    h.state.history.present.nodes[0],
    "right",
  );
  h.state.hoveredElement = new TestElement(false, true, {
    nodeId: "b",
    connectionSide: "left",
  });
  h.call(
    "endGesture",
    pointer({ type: "pointerup", buttons: 0, clientX: 320, clientY: 275 }),
  );
  const document = h.state.history.present;
  h.call("selectNode", "b");
  h.call("deleteSelection");
  assert.equal(h.state.history.present.connections.length, 0);
  h.call("undo");
  assert.equal(h.state.history.present, document);
});

test("기존 문서는 빈 연결 목록으로 열고 잘못된 연결 데이터는 거절한다", () => {
  const document = fixture();
  document.nodes = document.nodes.map((node) => ({
    ...node,
    id: randomUUID(),
  }));
  const legacy = { canvas: document.canvas, nodes: document.nodes };
  assert.deepEqual(workspaceDocumentSchema.parse(legacy).connections, []);
  const connection = {
    id: randomUUID(),
    source: { nodeId: document.nodes[0].id, side: "right" },
    target: { nodeId: document.nodes[1].id, side: "left" },
  };
  const valid = { ...document, connections: [connection] };
  assert.ok(workspaceDocumentSchema.safeParse(valid).success);
  assert.deepEqual(
    workspaceDocumentSchema.parse(JSON.parse(JSON.stringify(valid))),
    valid,
  );
  for (const target of [
    { nodeId: randomUUID(), side: "left" },
    { nodeId: document.nodes[0].id, side: "left" },
    { nodeId: document.nodes[1].id, side: "invalid" },
  ]) {
    assert.ok(
      !workspaceDocumentSchema.safeParse({
        ...document,
        connections: [{ ...connection, target }],
      }).success,
    );
  }
  assert.ok(
    !workspaceDocumentSchema.safeParse({
      ...valid,
      connections: [
        connection,
        {
          ...connection,
          id: randomUUID(),
          source: connection.target,
          target: connection.source,
        },
      ],
    }).success,
  );
});

test("네 방향 스냅은 확대율에 관계없이 화면 기준 반경을 유지한다", () => {
  const document = fixture();
  const source: ConnectionEndpoint = { nodeId: "a", side: "right" };
  for (const zoom of [0.1, 0.5, 1, 2]) {
    for (const side of CONNECTION_SIDES) {
      const node = document.nodes[1];
      const point = getConnectionPoint(node, side);
      const direction = {
        top: { x: 0, y: -1 },
        right: { x: 1, y: 0 },
        bottom: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
      }[side];
      const near = {
        x: point.x + (direction.x * (CONNECTION_SNAP_RADIUS - 1)) / zoom,
        y: point.y + (direction.y * (CONNECTION_SNAP_RADIUS - 1)) / zoom,
      };
      const far = {
        x: point.x + (direction.x * (CONNECTION_SNAP_RADIUS + 1)) / zoom,
        y: point.y + (direction.y * (CONNECTION_SNAP_RADIUS + 1)) / zoom,
      };
      assert.deepEqual(
        findConnectionTarget(document.nodes, [], source, near, zoom, node.id),
        { nodeId: "b", side },
      );
      assert.equal(
        findConnectionTarget(document.nodes, [], source, far, zoom, node.id),
        null,
      );
    }
  }
});

test("가장 가까운 점만 찾고 자신·중복 연결·겹친 뒷노드는 제외한다", () => {
  const nodes = fixture().nodes;
  const source: ConnectionEndpoint = { nodeId: "a", side: "right" };
  const target: ConnectionEndpoint = { nodeId: "b", side: "left" };
  const point = getConnectionPoint(nodes[1], "left");
  assert.deepEqual(findConnectionTarget(nodes, [], source, point, 1), target);
  assert.equal(
    findConnectionTarget(
      nodes,
      [],
      source,
      getConnectionPoint(nodes[0], "right"),
      1,
    ),
    null,
  );
  assert.equal(
    findConnectionTarget(
      nodes,
      [{ id: "edge", source: target, target: source }],
      source,
      point,
      1,
    ),
    null,
  );
  assert.equal(findConnectionTarget(nodes, [], source, point, 1, "c"), null);
  assert.equal(findConnectionTarget(nodes, [], source, point, 0), null);
  const nearNode = { ...nodes[1], id: "near", position: { x: 605, y: 400 } };
  assert.deepEqual(
    findConnectionTarget(
      [...nodes, nearNode],
      [],
      source,
      { x: 604, y: 470 },
      1,
    ),
    { nodeId: "near", side: "left" },
  );
});

test("스냅 범위를 벗어나면 해제되고 놓는 위치에서 대상을 다시 검사한다", () => {
  const h = setup();
  const document = h.state.history.present;
  h.call("startNodeConnection", pointer(), document.nodes[0], "right");
  h.call("moveGesture", pointer({ clientX: 310, clientY: 275 }));
  assert.equal(h.state.draft?.hoveredNodeId, "b");
  assert.deepEqual(h.state.draft?.pointer, { x: 600, y: 470 });
  h.call("moveGesture", pointer({ clientX: 290, clientY: 275 }));
  assert.equal(h.state.draft?.target, null);
  assert.deepEqual(h.state.draft?.pointer, { x: 540, y: 470 });
  h.call("moveGesture", pointer({ clientX: 310, clientY: 275 }));
  // 마지막 미리보기가 붙어 있어도 실제 release 위치가 멀면 연결하지 않는다.
  h.call(
    "endGesture",
    pointer({ type: "pointerup", buttons: 0, clientX: 290, clientY: 275 }),
  );
  assert.equal(h.state.history.present, document);
  assert.equal(h.state.history.past.length, 0);
});

test("저장 가능한 연결 수 제한을 넘는 드래그는 시작하지 않는다", () => {
  const h = setup();
  const document = h.state.history.present;
  h.state.history = createWorkspaceHistory({
    ...document,
    connections: Array.from({ length: MAX_CONNECTIONS }, (_, i) => ({
      id: String(i),
      source: { nodeId: "a", side: "right" },
      target: { nodeId: "b", side: "left" },
    })),
  });
  h.call("startNodeConnection", pointer(), document.nodes[0], "right");
  assert.equal(h.gestureRef.current, null);
  assert.equal(h.state.draft, null);
});

function setupConnection() {
  const h = setup(["a"]);
  const document = {
    ...fixture(),
    connections: [
      {
        id: "edge",
        source: { nodeId: "a", side: "right" as const },
        target: { nodeId: "b", side: "left" as const },
      },
    ],
  };
  h.state.history = createWorkspaceHistory(document);
  return h;
}

test("연결선 선택은 노드 선택과 분리되고 문서·이력을 바꾸지 않는다", () => {
  const h = setupConnection();
  const document = h.state.history.present;
  h.call("selectConnection", "missing");
  assert.deepEqual(h.state.selected, ["a"]);
  h.call("selectConnection", "edge");
  assert.deepEqual(h.state.selected, []);
  assert.equal(h.state.selectedConnection, "edge");
  assert.equal(h.state.history.present, document);
  assert.equal(h.state.history.past.length, 0);
  h.call("selectNode", "b");
  assert.equal(h.state.selectedConnection, null);
  assert.deepEqual(h.state.selected, ["b"]);
  h.call("selectConnection", "edge");
  h.call("handleWorkspaceKeyDown", key("Escape"));
  assert.equal(h.state.selectedConnection, null);
  h.call("selectConnection", "edge");
  h.call("startMarquee", pointer());
  assert.equal(h.state.selectedConnection, null);
  h.call("clearGesture");
});

test("선택한 연결선만 Delete·Backspace·버튼으로 삭제하고 Undo/Redo한다", () => {
  for (const action of ["Delete", "Backspace", "button"]) {
    const h = setupConnection();
    const document = h.state.history.present;
    h.call("selectConnection", "edge");
    const beforeDeleteFocus = h.state.focusCount;
    if (action === "button") h.call("deleteSelection");
    else h.call("handleWorkspaceKeyDown", key(action));
    assert.equal(h.state.history.present.nodes, document.nodes);
    assert.equal(h.state.history.present.connections.length, 0);
    assert.equal(h.state.history.past.length, 1);
    assert.equal(h.state.selectedConnection, null);
    assert.equal(h.state.focusCount, beforeDeleteFocus + 1);
    h.call("undo");
    assert.equal(h.state.history.present, document);
    h.call("redo");
    assert.equal(h.state.history.present.connections.length, 0);
  }
});

test("입력칸 삭제와 진행 중인 드래그는 연결선 삭제로 처리하지 않는다", () => {
  const h = setupConnection();
  const document = h.state.history.present;
  h.call("selectConnection", "edge");
  const inputKey = key("Delete", { target: new TestElement(true) });
  h.call("handleWorkspaceKeyDown", inputKey);
  assert.equal(inputKey.defaultPrevented, false);
  assert.equal(h.state.history.present, document);
  h.call("startNodeConnection", pointer(), document.nodes[0], "right");
  h.call("selectConnection", "edge");
  assert.equal(h.state.selectedConnection, null);
  h.call("deleteSelection");
  assert.equal(h.state.history.present, document);
  h.call("clearGesture");
});

test("Shift 박스 선택은 기존 선택을 합치고 Escape는 원래 선택으로 복원한다", () => {
  const h = setup(["c"]);
  h.call("startMarquee", pointer({ shiftKey: true }));
  h.call("moveGesture", pointer({ clientX: 100, clientY: 110 }));
  assert.deepEqual(h.state.selected, ["c", "a"]);
  h.call("handleWorkspaceKeyDown", key("Escape"));
  assert.deepEqual(h.state.selected, ["c"]);
  assert.equal(h.gestureRef.current, null);
  assert.equal(h.state.rect, null);
});

test("빈 공간 클릭은 선택 해제하고 노드 위에서는 박스 선택을 시작하지 않는다", () => {
  const h = setup(["a"]);
  h.call("startMarquee", pointer({ target: new TestElement(false, true) }));
  assert.equal(h.gestureRef.current, null);
  h.call("startMarquee", pointer());
  assert.deepEqual(h.state.selected, []);
  h.call("moveGesture", pointer({ clientX: 21, clientY: 41 }));
  assert.equal(h.state.rect, null);
});

test("제목 바 클릭과 미세 이동은 캡처·문서 변경 없이 끝나 더블클릭을 유지한다", () => {
  const h = setup(["a"]);
  const document = h.state.history.present;
  for (let click = 0; click < 2; click++) {
    h.call("startNodeDrag", pointer(), document.nodes[0]);
    assert.equal(h.state.captured, false);
    h.call("moveGesture", pointer({ clientX: 21, clientY: 41 }));
    assert.equal(h.state.history.present, document);
    assert.equal(h.state.captured, false);
    h.call("endGesture", pointer({ buttons: 0 }));
  }
  assert.equal(h.gestureRef.current, null);
  assert.equal(h.state.history.past.length, 0);
});

test("제목 바 드래그는 3px 이상 이동할 때 캡처하고 한 번의 이력으로 끝난다", () => {
  const h = setup(["a"]);
  const document = h.state.history.present;
  h.call("startNodeDrag", pointer(), document.nodes[0]);
  h.call("moveGesture", pointer({ clientX: 23, clientY: 40 }));
  assert.equal(h.state.captured, true);
  assert.equal(h.state.history.present.nodes[0].position.x, 106);
  h.call("endGesture", pointer({ buttons: 0 }));
  assert.equal(h.state.captured, false);
  assert.equal(h.state.history.past.length, 1);
  h.call("undo");
  assert.equal(h.state.history.present, document);
});

test("그룹 이동은 경계에서도 간격을 유지하며 실행 취소 한 번으로 복원한다", () => {
  const h = setup(["a", "b"]);
  const document = h.state.history.present;
  h.call("startNodeDrag", pointer(), document.nodes[0]);
  for (let i = 1; i <= 20; i++)
    h.call(
      "moveGesture",
      pointer({ clientX: 20 + i * 100, clientY: 40 + i * 100 }),
    );
  assert.deepEqual(h.state.history.present.nodes[0].position, {
    x: 1300,
    y: 760,
  });
  assert.deepEqual(h.state.history.present.nodes[1].position, {
    x: 1800,
    y: 1060,
  });
  assert.equal(h.state.history.past.length, 0);
  h.call("endGesture", pointer({ buttons: 0 }));
  assert.equal(h.state.history.past.length, 1);
  h.call("undo");
  assert.equal(h.state.history.present, document);
  h.call("redo");
  assert.deepEqual(h.state.history.present.nodes[1].position, {
    x: 1800,
    y: 1060,
  });
});

test("무한 캔버스의 실제 그룹 드래그는 음수·기존 경계를 넘어도 간격을 유지한다", () => {
  const h = setup(["a", "b"]);
  h.state.history.present.canvas.infinite = true;
  const document = h.state.history.present;
  h.call("startNodeDrag", pointer(), document.nodes[0]);
  h.call("moveGesture", pointer({ clientX: -4980, clientY: -4960 }));
  assert.deepEqual(h.state.history.present.nodes[0].position, {
    x: -9900,
    y: -9900,
  });
  assert.deepEqual(h.state.history.present.nodes[1].position, {
    x: -9400,
    y: -9600,
  });
  h.call("endGesture", pointer({ buttons: 0 }));
  h.call("undo");
  assert.equal(h.state.history.present, document);
});

test("무한 캔버스의 실제 크기 조절은 기존 캔버스 크기에 제한되지 않는다", () => {
  const h = setup(["a"]);
  h.state.history.present.canvas.infinite = true;
  h.call("startNodeResize", pointer(), h.state.history.present.nodes[0]);
  h.call("moveGesture", pointer({ clientX: 2020, clientY: 2040 }));
  assert.equal(h.state.history.present.nodes[0].width, 4320);
  assert.equal(h.state.history.present.nodes[0].height, 4220);
  h.call("endGesture", pointer({ buttons: 0 }));
  assert.equal(h.state.history.past.length, 1);
});

test("크기 조절 Escape는 변경과 이력을 취소하고 포인터 캡처를 해제한다", () => {
  const h = setup(["a", "b"]);
  const document = h.state.history.present;
  h.call("startNodeResize", pointer(), document.nodes[0]);
  h.call("moveGesture", pointer({ clientX: 120, clientY: 90 }));
  assert.equal(h.state.history.present.nodes[0].width, 520);
  h.call("handleWorkspaceKeyDown", key("Escape"));
  assert.equal(h.state.history.present, document);
  assert.equal(h.state.history.past.length, 0);
  assert.equal(h.state.captured, false);
});

test("드래그 제자리 복귀와 이동량 없는 클릭은 미저장 문서를 만들지 않는다", () => {
  const h = setup(["a"]);
  const document = h.state.history.present;
  h.call("startNodeDrag", pointer(), document.nodes[0]);
  h.call("moveGesture", pointer({ clientX: 80, clientY: 80 }));
  h.call("moveGesture", pointer());
  h.call("endGesture", pointer({ buttons: 0 }));
  assert.equal(h.state.history.present, document);
  assert.equal(h.state.history.past.length, 0);
});

test("포커스를 잃은 드래그도 한 번으로 기록되고 삭제로 중단되지 않는다", () => {
  const h = setup(["a"]);
  h.call("startNodeDrag", pointer(), h.state.history.present.nodes[0]);
  h.call("moveGesture", pointer({ clientX: 100 }));
  h.call("deleteSelection");
  assert.equal(h.state.history.present.nodes.length, 3);
  h.call("clearGesture");
  assert.equal(h.state.history.past.length, 1);
  assert.equal(h.gestureRef.current, null);
  assert.equal(h.state.captured, false);
});

test("일괄 삭제와 복원은 노드 ID·본문·위치를 함께 유지한다", () => {
  const h = setup(["a", "c"]);
  const document = h.state.history.present;
  h.call("deleteSelection");
  assert.deepEqual(
    h.state.history.present.nodes.map((node) => node.id),
    ["b"],
  );
  h.call("undo");
  assert.equal(h.state.history.present, document);
  h.call("redo");
  assert.deepEqual(
    h.state.history.present.nodes.map((node) => node.id),
    ["b"],
  );
});

test("입력칸의 Ctrl+Z·IME는 유지하고 편집 종료 후 전체 이력을 조작한다", () => {
  const h = setup();
  h.call("beginTextEdit");
  for (const title of ["한", "한글", "한글 입력"])
    h.call("updateTextNode", "a", { title });
  const inputKey = key("z", { ctrlKey: true, target: new TestElement(true) });
  h.call("handleWorkspaceKeyDown", inputKey);
  assert.equal(inputKey.defaultPrevented, false);
  const composingKey = key("z", {
    ctrlKey: true,
    nativeEvent: { isComposing: true },
  });
  h.call("handleWorkspaceKeyDown", composingKey);
  assert.equal(composingKey.defaultPrevented, false);
  h.call("endTextEdit");
  assert.equal(h.state.history.past.length, 1);
  h.call("handleWorkspaceKeyDown", key("z", { ctrlKey: true }));
  assert.equal(h.state.history.present.nodes[0].title, "A");
  h.call("handleWorkspaceKeyDown", key("z", { ctrlKey: true, shiftKey: true }));
  assert.equal(h.state.history.present.nodes[0].title, "한글 입력");
});

test("다른 포인터 이벤트는 무시하고 버튼이 풀리면 드래그를 종료한다", () => {
  const h = setup(["a"]);
  const document = h.state.history.present;
  h.call("startNodeDrag", pointer(), document.nodes[0]);
  h.call("moveGesture", pointer({ pointerId: 2, clientX: 200 }));
  assert.equal(h.state.history.present, document);
  h.call("moveGesture", pointer({ buttons: 0 }));
  assert.equal(h.gestureRef.current, null);
  assert.equal(h.state.history.past.length, 0);
});

test("검색 결과 고르기: 같은 캔버스면 가운데 두고 선택, 활성 항목을 비우고 검색칸으로 돌아간다", () => {
  const h = setup();
  h.state.searchActive = 2;
  const node = h.state.history.present.nodes[1];
  h.call("pickSearchResult", { node, path: [], trail: [], anchorId: node.id });
  assert.deepEqual(h.state.selected, ["b"]);
  assert.equal(h.state.searchActive, null);
  // 뷰포트 1000×700 가운데에 노드 중심(700, 470)이 오도록, 배율 0.5 유지
  assert.deepEqual(h.state.camera, { x: 150, y: 115, zoom: 0.5 });
  assert.ok(h.state.calls.includes("focus-search"));
  assert.equal(h.state.history.past.length, 0);
});

test("검색 결과 고르기: 다른 캔버스면 이동을 예약하고, 없는 노드는 무시한다", () => {
  const h = setup();
  const inner = { ...h.state.history.present.nodes[0], id: "inner" };
  h.state.history = createWorkspaceHistory({
    ...fixture(),
    nodes: [
      ...fixture().nodes,
      {
        id: "sub",
        type: "canvas_node",
        position: { x: 0, y: 0 },
        width: 260,
        height: 140,
        title: "하위",
        document: {
          canvas: { width: 2000, height: 1200 },
          connections: [],
          nodes: [inner],
        },
      },
    ],
  });
  h.state.searchActive = 3;
  h.call("pickSearchResult", {
    node: inner,
    path: ["sub"],
    trail: ["하위"],
    anchorId: "sub",
  });
  assert.deepEqual(h.state.pendingFocus, { key: "sub", nodeId: "inner" });
  assert.ok(h.state.calls.includes("navigate"));
  assert.equal(h.state.searchActive, null);
  assert.ok(h.state.calls.includes("focus-search"));

  const before = h.state.calls.length;
  h.call("pickSearchResult", {
    node: { ...inner, id: "gone" },
    path: ["sub"],
    trail: [],
    anchorId: "sub",
  });
  assert.equal(h.state.calls.length, before);
});

test("태그 렌즈: 태그를 누르면 검색이 #태그로 바로 열려 그 태그 노드만 또렷해진다", () => {
  const h = setup();
  h.state.searchActive = 4;
  h.call("openTagLens", { id: "t", name: "디자인", color: "moss" });
  assert.equal(h.state.searchOpen, true);
  // 끝의 공백은 태그 후보 칩을 다시 띄우지 않게 한다. 디바운스 없이 바로 흐린다.
  assert.equal(h.state.searchQuery, "#디자인 ");
  assert.equal(h.state.debouncedQuery, "#디자인 ");
  assert.equal(h.state.searchActive, null);
  assert.ok(h.state.calls.includes("focus-search"));
  assert.equal(h.state.history.past.length, 0);
});

test("단축키: Ctrl/Cmd+F는 입력칸 안에서도 브라우저 찾기 대신 노드 검색을 연다", () => {
  const h = setup();
  const inputKey = key("f", { ctrlKey: true, target: new TestElement(true) });
  h.call("handleWorkspaceKeyDown", inputKey);
  assert.equal(inputKey.defaultPrevented, true);
  const metaKey = key("F", { metaKey: true });
  h.call("handleWorkspaceKeyDown", metaKey);
  assert.equal(metaKey.defaultPrevented, true);
  assert.deepEqual(h.state.calls, ["search", "search"]);

  // 그냥 f는 검색을 열지 않는다.
  h.call("handleWorkspaceKeyDown", key("f"));
  assert.deepEqual(h.state.calls, ["search", "search"]);
  assert.equal(h.state.history.past.length, 0);
});

test("단축키: Ctrl+S는 입력칸에서도 저장, Ctrl+A 전체 선택, 방향키로 선택 노드 이동", () => {
  const h = setup();
  const inputKey = key("s", {
    ctrlKey: true,
    target: new TestElement(true),
  });
  h.call("handleWorkspaceKeyDown", inputKey);
  assert.equal(inputKey.defaultPrevented, true);
  assert.deepEqual(h.state.calls, ["save"]);

  h.call("handleWorkspaceKeyDown", key("a", { ctrlKey: true }));
  assert.deepEqual(
    h.state.selected,
    h.state.history.present.nodes.map((node) => node.id),
  );

  const [first] = h.state.history.present.nodes;
  h.state.selected = [first.id];
  const before = { ...first.position };
  h.call("handleWorkspaceKeyDown", key("ArrowRight"));
  h.call("handleWorkspaceKeyDown", key("ArrowDown", { shiftKey: true }));
  const moved = h.state.history.present.nodes.find(
    (node) => node.id === first.id,
  )!;
  assert.equal(moved.position.x, before.x + 8);
  assert.equal(moved.position.y, before.y + 40);
  // 노드를 옮기는 동안 다른 노드는 그대로다.
  for (const node of h.state.history.present.nodes)
    if (node.id !== first.id)
      assert.deepEqual(
        node.position,
        h.state.history.past[0]?.nodes.find((item) => item.id === node.id)
          ?.position ?? node.position,
      );

  h.call("handleWorkspaceKeyDown", key("t"));
  h.call("handleWorkspaceKeyDown", key("+", { shiftKey: true }));
  h.call("handleWorkspaceKeyDown", key("0"));
  h.call("handleWorkspaceKeyDown", key("d", { ctrlKey: true }));
  assert.deepEqual(h.state.calls.slice(1), [
    "add:text_node",
    "zoom:1.25",
    "fit",
    "duplicate",
  ]);
  // 입력칸 안의 일반 글자는 단축키가 아니다.
  h.call("handleWorkspaceKeyDown", key("t", { target: new TestElement(true) }));
  assert.equal(h.state.calls.length, 5);

  // P·E는 펜·지우개를 켠다.
  h.call("handleWorkspaceKeyDown", key("p"));
  h.call("handleWorkspaceKeyDown", key("e"));
  assert.deepEqual(h.state.calls.slice(5), ["tool:pen", "tool:eraser"]);
});

test("Space를 누른 왼쪽 드래그는 끝까지 화면을 옮긴다", () => {
  const h = setup();
  h.state.spaceHeld = true;
  const currentTarget = { focus() {}, setPointerCapture() {} };
  h.call("startPan", pointer({ currentTarget }));
  assert.equal(h.state.panning, true);
  // 왼쪽 버튼만 눌린 채(buttons: 1) 움직여도 이동이 이어진다.
  h.call("moveGesture", pointer({ clientX: 70, clientY: 90 }));
  assert.deepEqual(h.state.camera, { x: 60, y: 70, zoom: 0.5 });
  h.call("moveGesture", pointer({ clientX: 120, clientY: 90 }));
  assert.deepEqual(h.state.camera, { x: 110, y: 70, zoom: 0.5 });
});

function drawingFixture(strokes: drawing.DrawingStroke[]): WorkspaceDocument {
  return {
    canvas: { width: 2000, height: 1200, infinite: true },
    connections: [],
    nodes: [
      {
        id: "sub",
        type: "canvas_node",
        position: { x: 0, y: 0 },
        width: 260,
        height: 140,
        title: "하위",
        document: {
          canvas: { width: 2000, height: 1200, infinite: true },
          connections: [],
          nodes: [],
        },
      },
    ],
    drawing: { strokes },
  };
}

const horizontal: drawing.DrawingStroke = {
  id: "h",
  color: "teal",
  width: 4,
  points: [0, 0, 200, 0],
};

// 뷰포트 left 10, top 20, 카메라 (10, 20) 배율 0.5 → 화면 (x, y)는 캔버스 ((x-20)/0.5, (y-40)/0.5).
function at(canvasX: number, canvasY: number, extra = {}) {
  return pointer({
    clientX: 20 + canvasX * 0.5,
    clientY: 40 + canvasY * 0.5,
    ...extra,
  });
}

test("펜 선은 누른 순간의 공간에 한 단계로 붙고, 그사이 공간이 바뀌어도 섞이지 않는다", () => {
  const h = setup();
  h.state.history = createWorkspaceHistory(drawingFixture([]));
  h.state.tool = "pen";
  h.state.canvasPath = ["sub"];
  h.call("startDrawing", at(0, 0));
  h.call("moveGesture", at(100, 0));
  h.call("moveGesture", at(100, 100));
  // 그리는 도중 상위 공간으로 주소가 바뀐 상황.
  h.state.canvasPath = [];
  h.call("endGesture", at(100, 100, { type: "pointerup" }));
  const root = h.state.history.present;
  assert.deepEqual(root.drawing?.strokes, []);
  const sub = resolveWorkspacePath(root, ["sub"]).document;
  assert.equal(sub.drawing?.strokes.length, 1);
  assert.deepEqual(sub.drawing?.strokes[0].points, [0, 0, 100, 0, 100, 100]);
  assert.equal(h.state.history.past.length, 1);
});

test("지우개로 선이 나뉘어 공간 한도를 넘으면 반영하지 않고 알린다", () => {
  const h = setup();
  const dots = Array.from(
    { length: drawing.MAX_STROKES_PER_CANVAS - 1 },
    (_, i) => ({ ...horizontal, id: `d${i}`, points: [i * 10, 5000] }),
  );
  const original = drawingFixture([...dots, horizontal]);
  h.state.history = createWorkspaceHistory(original);
  h.state.tool = "eraser";
  h.call("startDrawing", at(100, -50));
  h.call("moveGesture", at(100, 50));
  h.call("endGesture", at(100, 50, { type: "pointerup" }));
  assert.equal(h.state.history.present, original);
  assert.equal(h.state.history.past.length, 0);
  assert.ok(h.state.calls.includes("notice:limit"));
});

test("지우개로 끝점이 늘어 프로젝트 점 한도를 넘으면 반영하지 않는다", () => {
  const h = setup();
  const full = Array.from(
    { length: drawing.MAX_POINTS_PER_STROKE * 2 },
    (_, k) => (k % 2 === 0 ? k : 9000),
  );
  const fillers = Array.from({ length: 74 }, (_, i) => ({
    ...horizontal,
    id: `f${i}`,
    points: full,
  }));
  // 4,000점 74선 + 3,998점 1선 + 2점 가로선 = 정확히 30만 점.
  // 가로선 가운데를 지우면 2점짜리 두 선(4점)이 되어 한도를 넘는다.
  const rest = {
    ...horizontal,
    id: "rest",
    points: full.slice(0, (drawing.MAX_POINTS_PER_STROKE - 2) * 2),
  };
  const original = drawingFixture([...fillers, rest, horizontal]);
  h.state.history = createWorkspaceHistory(original);
  h.state.tool = "eraser";
  h.call("startDrawing", at(100, -50));
  h.call("moveGesture", at(100, 50));
  h.call("endGesture", at(100, 50, { type: "pointerup" }));
  assert.ok(h.state.history.present === original, "문서가 바뀌었다");
  assert.equal(h.state.history.past.length, 0);
});

test("지우개 문지르기는 한 단계로 되돌리고, Escape는 문지르기 전으로 돌린다", () => {
  const h = setup();
  const original = drawingFixture([horizontal]);
  h.state.history = createWorkspaceHistory(original);
  h.state.tool = "eraser";
  h.call("startDrawing", at(100, -50));
  h.call("moveGesture", at(100, 50));
  h.call("endGesture", at(100, 50, { type: "pointerup" }));
  assert.equal(h.state.history.present.drawing?.strokes.length, 2);
  assert.equal(h.state.history.past.length, 1);

  h.state.history = createWorkspaceHistory(original);
  h.call("startDrawing", at(100, -50));
  h.call("moveGesture", at(100, 50));
  assert.equal(h.state.history.present.drawing?.strokes.length, 2);
  h.call("handleWorkspaceKeyDown", key("Escape"));
  assert.equal(h.state.history.present, original);
  assert.equal(h.state.history.past.length, 0);
});

test("단축키: K는 체크리스트 노드를 추가한다", () => {
  const h = setup();
  h.call("handleWorkspaceKeyDown", key("k"));
  assert.deepEqual(h.state.calls, ["add:checklist_node"]);
});

function groupedSetup() {
  const h = setup();
  const base = fixture();
  h.state.history = createWorkspaceHistory({
    ...base,
    groups: [{ id: "g", title: "그룹" }],
    nodes: base.nodes.map((node) =>
      node.id === "c" ? node : { ...node, groupId: "g" },
    ),
  } as WorkspaceDocument);
  return h;
}

test("startGroupDrag selects members and moves them together in one undo step", () => {
  const h = groupedSetup();
  h.call("startGroupDrag", pointer(), "g");
  assert.deepEqual(h.state.selected, ["a", "b"]);
  // 화면 +40px, 배율 0.5 → 캔버스 +80
  h.call("moveGesture", pointer({ clientX: 60, clientY: 40 }));
  const position = (id: string) =>
    h.state.history.present.nodes.find((node) => node.id === id)!.position;
  assert.deepEqual(position("a"), { x: 180, y: 100 });
  assert.deepEqual(position("b"), { x: 680, y: 400 });
  assert.deepEqual(position("c"), { x: 1200, y: 700 });
  h.call(
    "endGesture",
    pointer({ type: "pointerup", buttons: 0, clientX: 60, clientY: 40 }),
  );
  assert.equal(h.state.history.past.length, 1);
});

test("startGroupDrag on an empty group does nothing", () => {
  const h = groupedSetup();
  h.call("startGroupDrag", pointer(), "missing");
  assert.equal(h.gestureRef.current, null);
});

const groupOf = (h: ReturnType<typeof setup>, id: string) =>
  h.state.history.present.nodes.find((node) => node.id === id)!.groupId;
// 캔버스 (400, 300) = 화면 (220, 190): (clientX - 10 - 10) / 0.5
const insideGroup = { clientX: 220, clientY: 190 };

test("dragging ungrouped nodes onto a group joins on release in one undo step", () => {
  const h = groupedSetup();
  const c = h.state.history.present.nodes.find((node) => node.id === "c")!;
  h.call("startNodeDrag", pointer(), c);
  h.call("moveGesture", pointer(insideGroup));
  assert.equal(h.state.joinTarget, "g");
  h.call(
    "endGesture",
    pointer({ type: "pointerup", buttons: 0, ...insideGroup }),
  );
  assert.equal(groupOf(h, "c"), "g");
  assert.equal(h.state.history.past.length, 1);
  assert.equal(h.state.joinTarget, null);
  h.call("undo");
  assert.equal(groupOf(h, "c"), undefined);
});

test("mixed drag does not join", () => {
  const h = setup(["a", "c"]);
  const base = fixture();
  h.state.history = createWorkspaceHistory({
    ...base,
    groups: [
      { id: "g", title: "가" },
      { id: "h", title: "나" },
    ],
    nodes: base.nodes.map((node) =>
      node.id === "a"
        ? { ...node, groupId: "g" }
        : node.id === "b"
          ? { ...node, groupId: "h" }
          : node,
    ),
  } as WorkspaceDocument);
  const c = h.state.history.present.nodes.find((node) => node.id === "c")!;
  h.call("startNodeDrag", pointer(), c);
  // b(600,400) 그룹 h 안: 캔버스 (650, 450) = 화면 (345, 265)
  h.call("moveGesture", pointer({ clientX: 345, clientY: 265 }));
  assert.equal(h.state.joinTarget ?? null, null);
  h.call(
    "endGesture",
    pointer({ type: "pointerup", buttons: 0, clientX: 345, clientY: 265 }),
  );
  assert.equal(groupOf(h, "c"), undefined);
  assert.equal(groupOf(h, "a"), "g");
});

test("cancelled drag does not join", () => {
  const h = groupedSetup();
  const c = h.state.history.present.nodes.find((node) => node.id === "c")!;
  h.call("startNodeDrag", pointer(), c);
  h.call("moveGesture", pointer(insideGroup));
  h.call(
    "endGesture",
    pointer({ type: "pointercancel", buttons: 0, ...insideGroup }),
  );
  assert.equal(groupOf(h, "c"), undefined);
});

test("G groups the selection in one undo step", () => {
  const h = setup(["a", "c"]);
  h.call("handleWorkspaceKeyDown", key("g"));
  const nodes = h.state.history.present.nodes;
  const groupId = nodes.find((node) => node.id === "a")!.groupId;
  assert.ok(groupId);
  assert.equal(nodes.find((node) => node.id === "c")!.groupId, groupId);
  assert.equal(nodes.find((node) => node.id === "b")!.groupId, undefined);
  assert.deepEqual(
    h.state.history.present.groups?.map((group) => group.title),
    ["그룹"],
  );
  assert.equal(h.state.history.past.length, 1);
});

test("Shift+G ungroups only the selected members", () => {
  const h = groupedSetup();
  h.state.selected = ["a"];
  h.call("handleWorkspaceKeyDown", key("G", { shiftKey: true }));
  assert.equal(groupOf(h, "a"), undefined);
  assert.equal(groupOf(h, "b"), "g");
  assert.equal(h.state.history.past.length, 1);
});

test("G with nothing selected does nothing", () => {
  const h = setup();
  h.call("handleWorkspaceKeyDown", key("g"));
  assert.equal(h.state.history.past.length, 0);
  assert.equal(h.state.history.present.groups, undefined);
});

test("context menu key and Shift+F10 open the node menu for the selection", () => {
  const h = setup(["b"]);
  h.call("handleWorkspaceKeyDown", key("ContextMenu"));
  assert.ok(h.state.nodeMenu);
  h.state.nodeMenu = null;
  h.call("handleWorkspaceKeyDown", key("F10", { shiftKey: true }));
  assert.ok(h.state.nodeMenu);
  const empty = setup();
  empty.call("handleWorkspaceKeyDown", key("ContextMenu"));
  assert.equal(empty.state.nodeMenu ?? null, null);
});

test("grouping and ungrouping return focus to the canvas", () => {
  const h = setup(["a", "c"]);
  const before = h.state.focusCount;
  h.call("handleWorkspaceKeyDown", key("g"));
  assert.equal(h.state.focusCount, before + 1);
  h.call("handleWorkspaceKeyDown", key("G", { shiftKey: true }));
  assert.equal(h.state.focusCount, before + 2);
});

test("right-click selects the node unless it is already selected", () => {
  const h = setup(["b"]);
  const event = (nodeId: string | null) => ({
    clientX: 210,
    clientY: 120,
    target: new TestElement(false, nodeId !== null, nodeId ? { nodeId } : {}),
    preventDefault() {},
  });
  h.call("openNodeMenuAt", event("a"));
  assert.deepEqual(h.state.selected, ["a"]);
  assert.deepEqual(h.state.nodeMenu, { left: 200, top: 100 });

  h.state.selected = ["b", "c"];
  h.state.nodeMenu = null;
  h.call("openNodeMenuAt", event("c"));
  assert.deepEqual(h.state.selected, ["b", "c"]);
  assert.ok(h.state.nodeMenu);

  h.state.nodeMenu = null;
  h.call("openNodeMenuAt", event(null));
  assert.equal(h.state.nodeMenu ?? null, null);
});

test("tab drag stops the whole group at the finite canvas edge", () => {
  const h = groupedSetup();
  h.call("startGroupDrag", pointer(), "g");
  // 화면 +1000px = 캔버스 +2000, 오른쪽 끝(b 800 → 2000)에서 +1200으로 멈춘다.
  h.call("moveGesture", pointer({ clientX: 1020, clientY: 40 }));
  const x = (id: string) =>
    h.state.history.present.nodes.find((node) => node.id === id)!.position.x;
  assert.equal(x("a"), 1300);
  assert.equal(x("b"), 1800);
  assert.equal(x("b") - x("a"), 500);
});

test("renaming a group is one undo step", () => {
  const h = groupedSetup();
  h.call("applyDocumentChange", (root: WorkspaceDocument, path: string[]) =>
    groupOps.renameGroup(root, path, "g", "회의"),
  );
  assert.equal(h.state.history.present.groups![0].title, "회의");
  assert.equal(h.state.history.past.length, 1);
  h.call("undo");
  assert.equal(h.state.history.present.groups![0].title, "그룹");
});
