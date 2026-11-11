import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  MAX_POINTS_PER_STROKE,
  MAX_STROKES_PER_CANVAS,
  appendPoint,
  countStrokePoints,
  eraseStrokes,
  simplifyPoints,
  strokePath,
  type DrawingStroke,
} from "../src/features/workspace/drawing";
import { workspaceDocumentSchema } from "../src/features/workspace/workspace-schema";

function line(): DrawingStroke {
  const points: number[] = [];
  for (let x = 0; x <= 100; x += 10) points.push(x, 0);
  return { id: "s1", color: "teal", width: 4, points };
}

function ids() {
  let next = 0;
  return () => `new-${++next}`;
}

test("appendPoint는 소수 첫째 자리로 반올림해 붙인다", () => {
  assert.deepEqual(appendPoint([], 1.234, 5.678, 0), [1.2, 5.7]);
});

test("appendPoint는 너무 가까운 점을 버리고 같은 배열을 돌려준다", () => {
  const points = [0, 0];
  assert.equal(appendPoint(points, 1, 0, 1.5), points);
  assert.deepEqual(appendPoint(points, 2, 0, 1.5), [0, 0, 2, 0]);
});

test("appendPoint는 점 한도에 닿으면 더 붙이지 않는다", () => {
  const points = Array.from({ length: MAX_POINTS_PER_STROKE * 2 }, (_, i) =>
    i % 2 === 0 ? i * 5 : 0,
  );
  assert.equal(appendPoint(points, 1e6, 0, 0), points);
});

test("simplifyPoints는 일직선을 양 끝 두 점으로 줄인다", () => {
  assert.deepEqual(simplifyPoints(line().points, 0.5), [0, 0, 100, 0]);
});

test("simplifyPoints는 꺾인 점과 점 하나짜리 선을 유지한다", () => {
  assert.deepEqual(
    simplifyPoints([0, 0, 50, 0, 50, 50], 0.5),
    [0, 0, 50, 0, 50, 50],
  );
  assert.deepEqual(simplifyPoints([3, 4], 0.5), [3, 4]);
});

test("strokePath는 점·직선·곡선 경로를 만든다", () => {
  assert.equal(strokePath([3, 4]), "M3 4l0.01 0");
  assert.equal(strokePath([0, 0, 10, 0]), "M0 0L10 0");
  const curve = strokePath(line().points);
  assert.match(curve, /^M0 0/);
  assert.match(curve, /Q/);
  assert.match(curve, /L100 0$/);
});

test("eraseStrokes: 가운데를 지우면 선이 둘로 나뉜다", () => {
  const result = eraseStrokes([line()], [50, -20, 50, 20], 5, ids());
  assert.equal(result.length, 2);
  const [left, right] = result;
  assert.ok(left.points.at(-2)! < 50);
  assert.ok(right.points[0] > 50);
  for (const stroke of result) {
    assert.equal(stroke.color, "teal");
    assert.equal(stroke.width, 4);
  }
  assert.deepEqual(
    result.map((stroke) => stroke.id),
    ["new-1", "new-2"],
  );
});

test("eraseStrokes: 끝을 지우면 선이 짧아진다", () => {
  const result = eraseStrokes([line()], [100, -20, 100, 20], 5, ids());
  assert.equal(result.length, 1);
  assert.ok(result[0].points.at(-2)! < 100);
  assert.equal(result[0].points[0], 0);
});

test("eraseStrokes: 선 전체를 덮으면 사라진다", () => {
  assert.deepEqual(eraseStrokes([line()], [0, 0, 100, 0], 5, ids()), []);
});

test("eraseStrokes: 닿지 않으면 입력 배열을 그대로 돌려준다", () => {
  const strokes = [line()];
  assert.equal(eraseStrokes(strokes, [0, 500, 100, 500], 5, ids()), strokes);
});

test("eraseStrokes: 닿지 않은 선은 같은 객체로 남는다", () => {
  const far = { ...line(), id: "far", points: [0, 500, 100, 500] };
  const result = eraseStrokes([line(), far], [50, -20, 50, 20], 5, ids());
  assert.equal(result.length, 3);
  assert.equal(result[2], far);
});

test("eraseStrokes: 점 하나짜리 선도 지운다", () => {
  const dot = { ...line(), points: [50, 0] };
  assert.deepEqual(eraseStrokes([dot], [50, -20, 50, 20], 5, ids()), []);
});

test("countStrokePoints는 모든 선의 점을 센다", () => {
  assert.equal(countStrokePoints([line(), { ...line(), points: [1, 2] }]), 12);
});

function documentWith(drawing?: unknown, nodes: unknown[] = []) {
  return {
    canvas: { width: 2000, height: 1200, infinite: true },
    nodes,
    connections: [],
    ...(drawing === undefined ? {} : { drawing }),
  };
}

function stroke(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    color: "teal",
    width: 4,
    points: [0, 0, 10, 10],
    ...overrides,
  };
}

function canvasNode(id: string, drawing: unknown) {
  return {
    id,
    type: "canvas_node",
    position: { x: 0, y: 0 },
    width: 260,
    height: 140,
    title: "하위",
    document: documentWith(drawing),
  };
}

function parses(document: unknown) {
  return workspaceDocumentSchema.safeParse(document).success;
}

test("스키마: 그림이 없거나 비어 있는 문서를 받는다", () => {
  assert.ok(parses(documentWith()));
  assert.ok(parses(documentWith({ strokes: [] })));
});

test("스키마: 정상 선과 점 하나짜리 선을 받는다", () => {
  assert.ok(
    parses(
      documentWith({
        strokes: [stroke(), stroke({ id: "s2", points: [5, 5] })],
      }),
    ),
  );
});

test("스키마: 잘못된 선을 거절한다", () => {
  for (const bad of [
    { color: "black" },
    { width: 3 },
    { points: [1, 2, 3] },
    { points: [] },
    { points: [0, Infinity] },
  ]) {
    assert.equal(
      parses(documentWith({ strokes: [stroke(bad)] })),
      false,
      JSON.stringify(bad),
    );
  }
  assert.equal(parses(documentWith({ strokes: [stroke(), stroke()] })), false);
});

test("스키마: 공간 하나의 선 수와 선 하나의 점 수를 제한한다", () => {
  const many = Array.from({ length: MAX_STROKES_PER_CANVAS + 1 }, (_, i) =>
    stroke({ id: `s${i}` }),
  );
  assert.equal(parses(documentWith({ strokes: many })), false);
  const long = Array.from({ length: MAX_POINTS_PER_STROKE * 2 + 2 }, () => 1);
  assert.equal(
    parses(documentWith({ strokes: [stroke({ points: long })] })),
    false,
  );
});

test("스키마: 하위 캔버스의 그림도 검사한다", () => {
  assert.equal(
    parses(
      documentWith(undefined, [
        canvasNode(randomUUID(), { strokes: [stroke({ color: "black" })] }),
      ]),
    ),
    false,
  );
});

test("스키마: 프로젝트 전체 점 수를 제한한다", () => {
  const full = Array.from({ length: MAX_POINTS_PER_STROKE * 2 }, () => 1);
  // 공간 하나에 4,000점 선 75개 = 30만 점. 하위 캔버스 1점이 더해지면 초과.
  const strokes = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, i) =>
      stroke({ id: `${prefix}${i}`, points: full }),
    );
  const atLimit = documentWith({ strokes: strokes("a", 75) });
  assert.ok(parses(atLimit));
  const over = documentWith({ strokes: strokes("a", 75) }, [
    canvasNode(randomUUID(), { strokes: [stroke({ points: [1, 1] })] }),
  ]);
  assert.equal(parses(over), false);
});
