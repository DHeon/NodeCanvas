import type { ConnectionSide, NodeConnection, Point, TextNode } from "./types";

export const CONNECTION_SIDES: ConnectionSide[] = [
  "top",
  "right",
  "bottom",
  "left",
];

const directions: Record<ConnectionSide, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export function getConnectionPoint(
  node: TextNode,
  side: ConnectionSide,
): Point {
  const { x, y } = node.position;
  switch (side) {
    case "top":
      return { x: x + node.width / 2, y };
    case "right":
      return { x: x + node.width, y: y + node.height / 2 };
    case "bottom":
      return { x: x + node.width / 2, y: y + node.height };
    case "left":
      return { x, y: y + node.height / 2 };
  }
}

export function getConnectionPath(
  start: Point,
  end: Point,
  sourceSide: ConnectionSide,
  targetSide?: ConnectionSide,
): string {
  const length = Math.min(
    160,
    Math.max(30, Math.hypot(end.x - start.x, end.y - start.y) * 0.3),
  );
  const source = directions[sourceSide];
  const target = targetSide ? directions[targetSide] : { x: 0, y: 0 };
  return `M ${start.x} ${start.y} C ${start.x + source.x * length} ${start.y + source.y * length}, ${end.x + target.x * length} ${end.y + target.y * length}, ${end.x} ${end.y}`;
}

// 방향 표시가 없는 선이므로 같은 두 점의 역방향 연결도 중복으로 본다.
export function getConnectionKey(
  connection: Pick<NodeConnection, "source" | "target">,
): string {
  return [
    `${connection.source.nodeId}:${connection.source.side}`,
    `${connection.target.nodeId}:${connection.target.side}`,
  ]
    .sort()
    .join("|");
}
