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
  "startNodeDrag",
  "startNodeResize",
  "moveGesture",
  "endGesture",
  "updateTextNode",
  "deleteSelection",
  "getCanvasPoint",
  "getConnectionHover",
  "startNodeConnection",
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
  } | null;
  hoveredElement: TestElement | null;
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
  `
  const workspace = state.history.present;
  const selectedNodeIds = state.selected;
  const selectedConnectionId = state.selectedConnection;
  const camera = state.camera;
  const pendingImagesRef = { current: [] };
  const dispatchHistory = action => { state.history = workspaceHistoryReducer(state.history, action); };
  const setWorkspace = update => dispatchHistory({ type: "change", update });
  const setSelectedNodeIds = update => { state.selected = typeof update === "function" ? update(state.selected) : update; };
  const setSelectedConnectionId = value => { state.selectedConnection = value; };
  const setCamera = update => { state.camera = update(state.camera); };
  const setSelectionRect = rect => { state.rect = rect; };
  const setConnectionDraft = draft => { state.draft = draft; };
  const setIsPanning = value => { state.panning = value; };
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
