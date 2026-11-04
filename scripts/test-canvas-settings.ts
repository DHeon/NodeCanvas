import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  applyCanvasSettings,
  getFitCamera,
} from "../src/features/workspace/canvas-settings";
import {
  transformNode,
  fitNodeSize,
} from "../src/features/workspace/node-transform";
import { workspaceDocumentSchema } from "../src/features/workspace/workspace-schema";
import {
  createWorkspaceHistory,
  workspaceHistoryReducer,
} from "../src/features/workspace/workspace-history";
import type { WorkspaceDocument } from "../src/features/workspace/types";
import { expandLegacyCanvas } from "../src/features/workspace/create-workspace";

function fixture(): WorkspaceDocument {
  const a = randomUUID(),
    b = randomUUID();
  return {
    canvas: { width: 2000, height: 1200 },
    nodes: [
      {
        id: a,
        type: "text_node",
        title: "A",
        text: "내용",
        position: { x: 100, y: 100 },
        width: 320,
        height: 220,
      },
      {
        id: b,
        type: "text_node",
        title: "B",
        text: "",
        position: { x: 700, y: 400 },
        width: 320,
        height: 220,
      },
    ],
    connections: [
      {
        id: randomUUID(),
        source: { nodeId: a, side: "right" },
        target: { nodeId: b, side: "left" },
      },
    ],
  };
}

test("이전 문서는 그대로 유한으로 읽고 음수·경계 밖 좌표를 거절한다", () => {
  const document = fixture();
  assert.deepEqual(workspaceDocumentSchema.parse(document), document);
  document.nodes[0].position.x = -1;
  assert.equal(workspaceDocumentSchema.safeParse(document).success, false);
  document.nodes[0].position.x = 3000;
  assert.equal(workspaceDocumentSchema.safeParse(document).success, false);
});

test("직접 정한 1600×1000 크기와 무한 모드를 이전 기본값으로 오인하지 않는다", () => {
  for (const infinite of [true, false]) {
    const document = fixture();
    document.canvas = { width: 1600, height: 1000, infinite };
    assert.equal(expandLegacyCanvas(document), document);
  }
});

test("무한 문서는 음수와 기존 가로·세로 밖 노드, 연결선을 왕복한다", () => {
  let document = fixture();
  document.canvas.infinite = true;
  document = transformNode(document, document.nodes[0].id, {
    x: -25000,
    y: -30000,
  });
  document = transformNode(document, document.nodes[1].id, {
    x: 50000,
    y: 40000,
  });
  assert.equal(document.nodes[0].position.x, -25000);
  assert.deepEqual(
    workspaceDocumentSchema.parse(JSON.parse(JSON.stringify(document))),
    document,
  );
  assert.equal(document.connections.length, 1);
});

test("유한 축소는 배치 간격·크기·연결선을 유지하며 안으로 이동한다", () => {
  const document = fixture();
  const result = applyCanvasSettings(document, { width: 950, height: 550 });
  assert.ok(result.document);
  const next = result.document;
  assert.equal(next.nodes[1].position.x - next.nodes[0].position.x, 600);
  assert.equal(next.nodes[1].position.y - next.nodes[0].position.y, 300);
  assert.equal(next.nodes[0].width, 320);
  assert.deepEqual(next.connections, document.connections);
  assert.equal(next.nodes[1].position.x + next.nodes[1].width, 950);
  workspaceDocumentSchema.parse(next);
});

test("내용이 작은 캔버스에 맞지 않으면 문서를 수정하지 않는다", () => {
  const document = fixture();
  const original = JSON.stringify(document);
  const result = applyCanvasSettings(document, { width: 400, height: 300 });
  assert.match(result.error!, /최소 920 × 520/);
  assert.equal(JSON.stringify(document), original);
});

test("음수 영역에 놓인 노드를 유한으로 전환해도 모두 보존한다", () => {
  const document = fixture();
  document.canvas.infinite = true;
  document.nodes.forEach((node) => {
    node.position.x -= 10000;
    node.position.y -= 15000;
  });
  const result = applyCanvasSettings(document, {
    width: 1000,
    height: 600,
    infinite: false,
  });
  assert.ok(result.document);
  assert.deepEqual(result.document.nodes[0].position, { x: 0, y: 0 });
  assert.deepEqual(result.document.nodes[1].position, { x: 600, y: 300 });
  workspaceDocumentSchema.parse(result.document);
});

test("크기와 무한 전환도 Undo·Redo로 복원한다", () => {
  const document = fixture();
  const next = applyCanvasSettings(document, {
    ...document.canvas,
    infinite: true,
  }).document!;
  const changed = workspaceHistoryReducer(createWorkspaceHistory(document), {
    type: "change",
    update: () => next,
  });
  const undo = workspaceHistoryReducer(changed, { type: "undo" });
  assert.equal(undo.present, document);
  assert.equal(workspaceHistoryReducer(undo, { type: "redo" }).present, next);
  assert.equal(
    applyCanvasSettings(document, document.canvas).document,
    document,
  );
});

test("입력 범위를 벗어나는 크기와 유효하지 않은 숫자를 거절한다", () => {
  for (const width of [0, 319, 10001, 400.5, NaN, Infinity])
    assert.ok(applyCanvasSettings(fixture(), { width, height: 1000 }).error);
});

test("무한 화면 맞춤은 음수 좌표를 포함한 노드 전체를 맞춘다", () => {
  const document = fixture();
  document.canvas.infinite = true;
  document.nodes.forEach((node) => {
    node.position.x -= 10000;
    node.position.y -= 15000;
  });
  const camera = getFitCamera(document, 1000, 700);
  for (const node of document.nodes) {
    const left = node.position.x * camera.zoom + camera.x;
    const top = node.position.y * camera.zoom + camera.y;
    assert.ok(left >= 31.999 && top >= 31.999);
    assert.ok(left + node.width * camera.zoom <= 968.001);
    assert.ok(top + node.height * camera.zoom <= 668.001);
  }
  assert.ok(
    Number.isFinite(getFitCamera({ ...document, nodes: [] }, 1000, 700).zoom),
  );
});

test("무한 영역 이미지 크기 조절도 비율과 크기 상한을 지킨다", () => {
  const document = fixture();
  const image = {
    ...document.nodes[0],
    type: "image_node" as const,
    image: { id: randomUUID(), width: 200, height: 600, byteLength: 100 },
  };
  const size = fitNodeSize(
    image,
    { ...document.canvas, infinite: true },
    50000,
    50000,
  );
  assert.ok(size.width <= 10000 && size.height <= 10000);
  assert.ok(Math.abs((size.height - 48) / size.width - 3) < 1e-10);
});
