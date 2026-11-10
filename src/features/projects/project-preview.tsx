// 대시보드 카드용 미니 캔버스: 최상위 노드의 위치·크기만 축소해 보여준다.
type PreviewNode = {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const MAX_PREVIEW_NODES = 60;

/** 저장된 문서(JSONB)에서 미리보기에 필요한 최상위 노드만 방어적으로 꺼낸다. */
export function readPreview(document: unknown) {
  const nodes: PreviewNode[] = [];
  let total = 0;
  const list =
    document && typeof document === "object" && "nodes" in document
      ? (document as { nodes: unknown }).nodes
      : null;
  if (Array.isArray(list)) {
    total = list.length;
    for (const raw of list.slice(0, MAX_PREVIEW_NODES)) {
      if (!raw || typeof raw !== "object") continue;
      const node = raw as {
        type?: unknown;
        position?: { x?: unknown; y?: unknown };
        width?: unknown;
        height?: unknown;
      };
      const x = Number(node.position?.x);
      const y = Number(node.position?.y);
      const width = Number(node.width);
      const height = Number(node.height);
      if (
        [x, y, width, height].every(Number.isFinite) &&
        width > 0 &&
        height > 0
      )
        nodes.push({ type: String(node.type), x, y, width, height });
    }
  }
  return { nodes, total };
}

const fill: Record<string, string> = {
  text_node: "#ffffff",
  image_node: "var(--color-ochre-wash)",
  canvas_node: "var(--color-moss-wash)",
  link_node: "var(--color-mist)",
};

export default function ProjectPreview({ nodes }: { nodes: PreviewNode[] }) {
  if (nodes.length === 0) {
    return <span className="text-xs text-lichen">빈 캔버스</span>;
  }
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  const pad = Math.max(maxX - minX, maxY - minY) * 0.08 + 24;
  const viewBox = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      aria-hidden="true"
    >
      {nodes.map((node, index) => (
        <rect
          key={index}
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          rx={Math.min(node.width, node.height) * 0.08}
          fill={fill[node.type] ?? "#ffffff"}
          stroke="var(--color-sage-dot)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

const relative = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Infinity],
];

/** "방금 전", "3일 전" 같은 상대 시각. */
export function formatUpdatedAt(date: Date, now = Date.now()) {
  let value = (date.getTime() - now) / 1000;
  for (const [unit, size] of STEPS) {
    if (Math.abs(value) < size) {
      if (unit === "second") return "방금 전";
      return relative.format(Math.round(value), unit);
    }
    value /= size;
  }
  return relative.format(Math.round(value), "year");
}
