import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_POINTS_PER_STROKE,
  appendPoint,
  countStrokePoints,
  eraseStrokes,
  simplifyPoints,
  strokePath,
  type DrawingStroke,
} from "../src/features/workspace/drawing";

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
