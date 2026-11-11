import type { ConnectionColor } from "./connection-colors";

// 캔버스 배경에 손으로 그린 선. 사용자가 고르거나 옮기는 객체가 아니라
// 저장과 지우개 계산을 위한 단위일 뿐이다.
export const STROKE_WIDTHS = [2, 4, 8] as const;
export type StrokeWidth = (typeof STROKE_WIDTHS)[number];

export type DrawingStroke = {
  id: string;
  color: ConnectionColor;
  width: StrokeWidth;
  // [x0, y0, x1, y1, …] 캔버스 좌표, 소수 첫째 자리까지.
  points: number[];
};

export const MAX_STROKES_PER_CANVAS = 3000;
export const MAX_POINTS_PER_STROKE = 4000;
export const MAX_DRAWING_POINTS = 300_000;

function round(value: number) {
  return Math.round(value * 10) / 10;
}

/** 직전 점과 minDistance 이상 떨어졌을 때만 새 배열로 점을 붙인다. */
export function appendPoint(
  points: number[],
  x: number,
  y: number,
  minDistance: number,
): number[] {
  if (points.length >= MAX_POINTS_PER_STROKE * 2) return points;
  const nextX = round(x);
  const nextY = round(y);
  if (points.length >= 2) {
    const lastX = points[points.length - 2];
    const lastY = points[points.length - 1];
    if (Math.hypot(nextX - lastX, nextY - lastY) < minDistance) return points;
  }
  return [...points, nextX, nextY];
}

function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared),
        );
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Ramer–Douglas–Peucker. 처음과 끝 점은 항상 남긴다. */
export function simplifyPoints(points: number[], tolerance: number): number[] {
  const count = points.length / 2;
  if (count <= 2) return points;
  const keep = new Uint8Array(count);
  keep[0] = 1;
  keep[count - 1] = 1;
  const stack: [number, number][] = [[0, count - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let farthest = -1;
    let farthestDistance = tolerance;
    for (let i = start + 1; i < end; i++) {
      const distance = distanceToSegment(
        points[i * 2],
        points[i * 2 + 1],
        points[start * 2],
        points[start * 2 + 1],
        points[end * 2],
        points[end * 2 + 1],
      );
      if (distance > farthestDistance) {
        farthest = i;
        farthestDistance = distance;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = 1;
      stack.push([start, farthest], [farthest, end]);
    }
  }
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    if (keep[i]) result.push(points[i * 2], points[i * 2 + 1]);
  }
  return result;
}

/** 점을 지나는 부드러운 SVG 경로(중점을 잇는 2차 곡선). */
export function strokePath(points: number[]): string {
  const count = points.length / 2;
  if (count === 0) return "";
  const [x0, y0] = points;
  // 점 하나는 아주 짧은 선으로 그려 둥근 끝이 점처럼 보이게 한다.
  if (count === 1) return `M${x0} ${y0}l0.01 0`;
  if (count === 2) return `M${x0} ${y0}L${points[2]} ${points[3]}`;
  let path = `M${x0} ${y0}`;
  for (let i = 1; i < count - 1; i++) {
    const x = points[i * 2];
    const y = points[i * 2 + 1];
    const midX = round((x + points[i * 2 + 2]) / 2);
    const midY = round((y + points[i * 2 + 3]) / 2);
    path += `Q${x} ${y} ${midX} ${midY}`;
  }
  return `${path}L${points[count * 2 - 2]} ${points[count * 2 - 1]}`;
}

function distanceToPolyline(px: number, py: number, line: number[]) {
  if (line.length === 2) return Math.hypot(px - line[0], py - line[1]);
  let best = Infinity;
  for (let i = 0; i + 3 < line.length; i += 2) {
    best = Math.min(
      best,
      distanceToSegment(px, py, line[i], line[i + 1], line[i + 2], line[i + 3]),
    );
  }
  return best;
}

/** 선 위를 step 이하 간격으로 촘촘히 나눈 점 목록. */
function sampleStroke(points: number[], step: number): number[] {
  if (points.length <= 2) return points;
  const samples = [points[0], points[1]];
  for (let i = 0; i + 3 < points.length; i += 2) {
    const ax = points[i];
    const ay = points[i + 1];
    const bx = points[i + 2];
    const by = points[i + 3];
    const parts = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= parts; k++) {
      samples.push(
        round(ax + ((bx - ax) * k) / parts),
        round(ay + ((by - ay) * k) / parts),
      );
    }
  }
  return samples;
}

/**
 * 지우개 경로(eraser, 점 목록)에서 radius 안에 든 선 구간만 지운다.
 * 중간이 지워진 선은 남은 구간마다 새 선으로 나뉜다.
 * 아무것도 지우지 못하면 입력 배열을 그대로 돌려준다.
 */
export function eraseStrokes(
  strokes: DrawingStroke[],
  eraser: number[],
  radius: number,
  createId: () => string,
): DrawingStroke[] {
  if (eraser.length < 2) return strokes;
  let changed = false;
  const result: DrawingStroke[] = [];
  for (const stroke of strokes) {
    const hitRadius = radius + stroke.width / 2;
    const samples = sampleStroke(stroke.points, Math.max(radius / 2, 0.5));
    const runs: number[][] = [];
    let run: number[] = [];
    let erased = false;
    for (let i = 0; i < samples.length; i += 2) {
      const x = samples[i];
      const y = samples[i + 1];
      if (distanceToPolyline(x, y, eraser) <= hitRadius) {
        erased = true;
        if (run.length) runs.push(run);
        run = [];
      } else {
        run.push(x, y);
      }
    }
    if (!erased) {
      result.push(stroke);
      continue;
    }
    changed = true;
    if (run.length) runs.push(run);
    for (const kept of runs) {
      // 점 하나만 남은 조각은 버린다.
      if (kept.length < 4) continue;
      result.push({
        id: createId(),
        color: stroke.color,
        width: stroke.width,
        points: simplifyPoints(kept, 0.3),
      });
    }
  }
  return changed ? result : strokes;
}

export function countStrokePoints(strokes: readonly DrawingStroke[]): number {
  let total = 0;
  for (const stroke of strokes) total += stroke.points.length / 2;
  return total;
}
