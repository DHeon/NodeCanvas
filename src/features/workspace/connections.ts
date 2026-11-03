import type {
  ConnectionEndpoint,
  ConnectionSide,
  NodeConnection,
  Point,
  WorkspaceNode,
} from "./types";

export const CONNECTION_SNAP_RADIUS = 18; // 화면 기준 px
export const MAX_CONNECTIONS = 3000;

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
  node: WorkspaceNode,
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

// 캔버스 거리 × 확대율 = 화면 거리. 확대율에 관계없이 같은 범위에서 붙는다.
export function findConnectionTarget(
  nodes: WorkspaceNode[],
  connections: NodeConnection[],
  source: ConnectionEndpoint,
  pointer: Point,
  zoom: number,
  hoveredNodeId: string | null = null,
): ConnectionEndpoint | null {
  if (
    zoom <= 0 ||
    !Number.isFinite(zoom) ||
    connections.length >= MAX_CONNECTIONS
  )
    return null;

  const existingKeys = new Set(connections.map(getConnectionKey));
  let nearest: ConnectionEndpoint | null = null;
  let nearestDistance = CONNECTION_SNAP_RADIUS;
  for (const node of nodes) {
    // 노드 위에서는 그 노드의 점만 찾는다. 뒤에 겹친 노드로 연결하지 않는다.
    if (
      node.id === source.nodeId ||
      (hoveredNodeId && node.id !== hoveredNodeId)
    )
      continue;
    for (const side of CONNECTION_SIDES) {
      const target = { nodeId: node.id, side };
      if (existingKeys.has(getConnectionKey({ source, target }))) continue;
      const point = getConnectionPoint(node, side);
      const distance =
        Math.hypot(point.x - pointer.x, point.y - pointer.y) * zoom;
      if (distance <= nearestDistance) {
        nearest = target;
        nearestDistance = distance;
      }
    }
  }
  return nearest;
}
