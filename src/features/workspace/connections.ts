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

/** 키보드로 연결할 때 두 노드의 상대 위치로 마주 보는 변을 고른다. */
export function pickFacingSides(
  source: WorkspaceNode,
  target: WorkspaceNode,
): { source: ConnectionSide; target: ConnectionSide } {
  const dx =
    target.position.x +
    target.width / 2 -
    (source.position.x + source.width / 2);
  const dy =
    target.position.y +
    target.height / 2 -
    (source.position.y + source.height / 2);
  if (Math.abs(dx) >= Math.abs(dy))
    return dx >= 0
      ? { source: "right", target: "left" }
      : { source: "left", target: "right" };
  return dy >= 0
    ? { source: "bottom", target: "top" }
    : { source: "top", target: "bottom" };
}

export type ConnectionLineStyle = "curved" | "orthogonal";

const ORTHOGONAL_STUB = 24; // 연결점에서 수직으로 빠져나오는 길이
const ORTHOGONAL_RADIUS = 8; // 꺾이는 모서리의 둥근 정도

// 가로 기준으로 계산한 뒤 세로 연결은 x·y를 바꿔 같은 규칙을 쓴다.
const transposeSide: Record<ConnectionSide, ConnectionSide> = {
  right: "bottom",
  bottom: "right",
  left: "top",
  top: "left",
};
const swap = (point: Point): Point => ({ x: point.y, y: point.x });
const isHorizontal = (side: ConnectionSide) =>
  side === "left" || side === "right";

function orthogonalPoints(
  start: Point,
  end: Point,
  sourceSide: ConnectionSide,
  targetSide?: ConnectionSide,
): Point[] {
  if (!isHorizontal(sourceSide)) {
    return orthogonalPoints(
      swap(start),
      swap(end),
      transposeSide[sourceSide],
      targetSide && transposeSide[targetSide],
    ).map(swap);
  }
  const out = directions[sourceSide].x;
  const a = { x: start.x + out * ORTHOGONAL_STUB, y: start.y };
  if (!targetSide) {
    // 끌고 있는 미리보기: 한 번 꺾어 포인터까지.
    return [start, a, { x: a.x, y: end.y }, end];
  }
  const into = directions[targetSide];
  const b = {
    x: end.x + into.x * ORTHOGONAL_STUB,
    y: end.y + into.y * ORTHOGONAL_STUB,
  };
  if (!isHorizontal(targetSide)) {
    // 가로로 나가 세로로 들어간다: 모서리 하나.
    return [start, a, { x: b.x, y: a.y }, b, end];
  }
  if (into.x === out) {
    // 두 연결점이 같은 쪽을 보면 더 바깥쪽 세로선으로 감싼다.
    const x = out > 0 ? Math.max(a.x, b.x) : Math.min(a.x, b.x);
    return [start, { x, y: start.y }, { x, y: end.y }, end];
  }
  if ((b.x - a.x) * out >= 0) {
    // 마주 보는 방향: 가운데에서 한 번 세로로 꺾는다.
    const midX = (a.x + b.x) / 2;
    return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
  }
  // 뒤쪽으로 돌아가야 하면 두 노드 사이 높이로 우회한다.
  const midY = (a.y + b.y) / 2;
  return [start, a, { x: a.x, y: midY }, { x: b.x, y: midY }, b, end];
}

/** 점 목록을 같은 점·일직선 점을 걸러낸 뒤 모서리를 살짝 둥글린 경로로 만든다. */
function roundedPolyline(points: Point[]): string {
  const clean: Point[] = [];
  for (const point of points) {
    const last = clean.at(-1);
    if (last && last.x === point.x && last.y === point.y) continue;
    const before = clean.at(-2);
    if (
      before &&
      last &&
      ((before.x === last.x && last.x === point.x) ||
        (before.y === last.y && last.y === point.y))
    )
      clean[clean.length - 1] = point;
    else clean.push(point);
  }
  let path = `M ${clean[0].x} ${clean[0].y}`;
  for (let index = 1; index < clean.length - 1; index++) {
    const previous = clean[index - 1];
    const corner = clean[index];
    const next = clean[index + 1];
    const inLength = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const outLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    const radius = Math.min(ORTHOGONAL_RADIUS, inLength / 2, outLength / 2);
    const from = {
      x: corner.x - ((corner.x - previous.x) / inLength) * radius,
      y: corner.y - ((corner.y - previous.y) / inLength) * radius,
    };
    const to = {
      x: corner.x + ((next.x - corner.x) / outLength) * radius,
      y: corner.y + ((next.y - corner.y) / outLength) * radius,
    };
    path += ` L ${from.x} ${from.y} Q ${corner.x} ${corner.y} ${to.x} ${to.y}`;
  }
  const last = clean.at(-1)!;
  return `${path} L ${last.x} ${last.y}`;
}

/** 캔버스의 선 모양 설정에 따라 곡선 또는 90도로 꺾이는 경로. */
export function getStyledConnectionPath(
  style: ConnectionLineStyle | undefined,
  start: Point,
  end: Point,
  sourceSide: ConnectionSide,
  targetSide?: ConnectionSide,
): string {
  return style === "orthogonal"
    ? roundedPolyline(orthogonalPoints(start, end, sourceSide, targetSide))
    : getConnectionPath(start, end, sourceSide, targetSide);
}
