import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { applyCanvasSettings } from "../src/features/workspace/canvas-settings";
import {
  CONNECTION_COLORS,
  connectionColor,
} from "../src/features/workspace/connection-colors";
import {
  getConnectionPath,
  getStyledConnectionPath,
} from "../src/features/workspace/connections";
import { createWorkspace } from "../src/features/workspace/create-workspace";
import type { WorkspaceDocument } from "../src/features/workspace/types";
import { workspaceDocumentSchema } from "../src/features/workspace/workspace-schema";

function connected(): WorkspaceDocument {
  const document = createWorkspace();
  document.nodes = [0, 1].map((i) => ({
    id: randomUUID(),
    type: "text_node" as const,
    position: { x: 100 + i * 500, y: 100 + i * 200 },
    width: 320,
    height: 220,
    title: `노드 ${i + 1}`,
    text: "",
  }));
  document.connections = [
    {
      id: randomUUID(),
      source: { nodeId: document.nodes[0].id, side: "right" },
      target: { nodeId: document.nodes[1].id, side: "left" },
    },
  ];
  return document;
}

test("캔버스 보기 설정과 연결선 색은 저장·조회 형식으로 왕복하고, 이전 문서도 열린다", () => {
  const legacy = connected();
  assert.deepEqual(workspaceDocumentSchema.parse(legacy), legacy);

  const styled = connected();
  styled.canvas.lineStyle = "orthogonal";
  styled.canvas.grid = false;
  styled.connections[0].color = "rose";
  assert.deepEqual(workspaceDocumentSchema.parse(styled), styled);

  // 하위 캔버스도 각자 설정을 가진다.
  const nested = createWorkspace();
  const child = connected();
  child.canvas.lineStyle = "orthogonal";
  nested.nodes = [
    {
      id: randomUUID(),
      type: "canvas_node",
      position: { x: 10, y: 10 },
      width: 260,
      height: 140,
      title: "하위",
      document: child,
    },
  ];
  const parsed = workspaceDocumentSchema.parse(nested);
  assert.equal(parsed.canvas.lineStyle, undefined);
  const parsedChild = parsed.nodes[0];
  assert.equal(parsedChild.type, "canvas_node");
  if (parsedChild.type === "canvas_node")
    assert.equal(parsedChild.document.canvas.lineStyle, "orthogonal");
});

test("팔레트에 없는 색 이름과 모르는 선 모양은 거절한다", () => {
  const badColor = connected();
  (badColor.connections[0] as { color?: string }).color = "#ff0000";
  assert.equal(workspaceDocumentSchema.safeParse(badColor).success, false);

  const badStyle = connected();
  (badStyle.canvas as { lineStyle?: string }).lineStyle = "zigzag";
  assert.equal(workspaceDocumentSchema.safeParse(badStyle).success, false);
});

test("색 이름은 팔레트 값으로 바뀌고, 없거나 모르는 이름은 기본색이다", () => {
  assert.equal(CONNECTION_COLORS.length, 8);
  assert.equal(connectionColor(undefined).key, "lichen");
  assert.equal(connectionColor("nope").key, "lichen");
  assert.equal(connectionColor("teal").value, "#3f7d8c");
});

function segments(path: string) {
  // 둥근 모서리(Q)를 빼고 직선 구간(L)만 꺼내 가로·세로인지 본다.
  const points = [...path.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)].map(
    ([, x, y]) => ({ x: Number(x), y: Number(y) }),
  );
  const lines: [{ x: number; y: number }, { x: number; y: number }][] = [];
  const tokens = path.split(/(?=[MLQ])/).map((token) => token.trim());
  let cursor = points[0];
  for (const token of tokens.slice(1)) {
    const numbers = token.slice(1).trim().split(/\s+/).map(Number);
    const end = { x: numbers.at(-2)!, y: numbers.at(-1)! };
    if (token.startsWith("L")) lines.push([cursor, end]);
    cursor = end;
  }
  return lines;
}

test("각진 선은 가로·세로 직선과 둥근 모서리로만 이루어지고 양 끝점이 같다", () => {
  const cases: [
    { x: number; y: number },
    { x: number; y: number },
    "top" | "right" | "bottom" | "left",
    "top" | "right" | "bottom" | "left",
  ][] = [
    [{ x: 0, y: 0 }, { x: 300, y: 200 }, "right", "left"],
    [{ x: 300, y: 0 }, { x: 0, y: 200 }, "right", "left"], // 뒤로 돌아감
    [{ x: 0, y: 0 }, { x: 300, y: 200 }, "bottom", "top"],
    [{ x: 0, y: 0 }, { x: 300, y: 200 }, "right", "top"],
    [{ x: 0, y: 0 }, { x: 300, y: 200 }, "right", "right"], // 같은 방향
  ];
  for (const [start, end, sourceSide, targetSide] of cases) {
    const path = getStyledConnectionPath(
      "orthogonal",
      start,
      end,
      sourceSide,
      targetSide,
    );
    assert.ok(path.startsWith(`M ${start.x} ${start.y}`), path);
    assert.ok(path.endsWith(`L ${end.x} ${end.y}`), path);
    assert.ok(!path.includes(" C "), path);
    for (const [a, b] of segments(path))
      assert.ok(
        Math.abs(a.x - b.x) < 1e-9 || Math.abs(a.y - b.y) < 1e-9,
        `${sourceSide}→${targetSide} 대각선 구간: ${JSON.stringify([a, b])}`,
      );
  }
  // 곡선 설정과 설정 없음은 기존 경로와 같다.
  const args = [{ x: 0, y: 0 }, { x: 300, y: 200 }, "right", "left"] as const;
  assert.equal(
    getStyledConnectionPath(undefined, ...args),
    getConnectionPath(...args),
  );
  assert.equal(
    getStyledConnectionPath("curved", ...args),
    getConnectionPath(...args),
  );
});

test("캔버스 크기를 바꿔도 선 모양·점 배경 설정은 유지된다", () => {
  const document = connected();
  document.canvas.lineStyle = "orthogonal";
  document.canvas.grid = false;
  const result = applyCanvasSettings(document, {
    width: 3000,
    height: 2000,
    infinite: false,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.document!.canvas.lineStyle, "orthogonal");
  assert.equal(result.document!.canvas.grid, false);
  assert.equal(result.document!.canvas.width, 3000);
});
