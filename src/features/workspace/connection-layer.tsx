import { getConnectionPoint, getStyledConnectionPath } from "./connections";
import { connectionColor } from "./connection-colors";
import { nodeDisplayName } from "./workspace-tree";
import type {
  ConnectionDraft,
  NodeConnection,
  WorkspaceNode,
  WorkspaceDocument,
} from "./types";

type ConnectionLayerProps = {
  canvas: WorkspaceDocument["canvas"];
  nodes: WorkspaceNode[];
  connections: NodeConnection[];
  draft: ConnectionDraft | null;
  selectedConnectionId: string | null;
  zoom: number;
  onSelect: (connectionId: string) => void;
};

export default function ConnectionLayer({
  canvas,
  nodes,
  connections,
  draft,
  selectedConnectionId,
  zoom,
  onSelect,
}: ConnectionLayerProps) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const draftSource = draft ? nodesById.get(draft.source.nodeId) : undefined;

  return (
    <svg
      aria-label="노드 연결선"
      className="pointer-events-none absolute top-0 left-0 overflow-visible"
      width={canvas.infinite ? 1 : canvas.width}
      height={canvas.infinite ? 1 : canvas.height}
      fill="none"
    >
      {connections.map((connection) => {
        const source = nodesById.get(connection.source.nodeId);
        const target = nodesById.get(connection.target.nodeId);
        if (!source || !target) return null;
        const selected = connection.id === selectedConnectionId;
        const color = connectionColor(connection.color);
        const path = getStyledConnectionPath(
          canvas.lineStyle,
          getConnectionPoint(source, connection.source.side),
          getConnectionPoint(target, connection.target.side),
          connection.source.side,
          connection.target.side,
        );
        return (
          <g key={connection.id} className="group/connection">
            {/* 실제 선보다 넓은 투명 영역으로 선택한다. 빈 SVG 영역은 클릭을 막지 않는다. */}
            <path
              data-connection-hit={connection.id}
              d={path}
              role="button"
              tabIndex={draft ? -1 : 0}
              aria-label={`${nodeDisplayName(source)} ↔ ${nodeDisplayName(target)} 연결선, ${color.label}`}
              aria-pressed={selected}
              stroke="transparent"
              strokeWidth={14}
              vectorEffect="non-scaling-stroke"
              className={
                draft ? "pointer-events-none" : "cursor-pointer outline-none"
              }
              style={{ pointerEvents: draft ? "none" : "stroke" }}
              onPointerDown={(event) => {
                if (event.button !== 0 || draft) return;
                event.preventDefault();
                event.stopPropagation();
                onSelect(connection.id);
              }}
              onKeyDown={(event) => {
                if (draft || (event.key !== "Enter" && event.key !== " "))
                  return;
                event.preventDefault();
                event.stopPropagation();
                onSelect(connection.id);
              }}
            >
              <title>클릭해서 선택 · Delete로 연결선 삭제</title>
            </path>
            {/* 선택·호버는 선 고유 색을 유지한 채 같은 색의 옅은 띠로 표시한다. */}
            <path
              d={path}
              stroke={color.value}
              strokeOpacity={0}
              strokeWidth={10}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className={
                selected
                  ? "[stroke-opacity:0.22]"
                  : "group-focus-within/connection:[stroke-opacity:0.22] group-hover/connection:[stroke-opacity:0.14]"
              }
            />
            <path
              data-connection-id={connection.id}
              d={path}
              stroke={color.value}
              strokeWidth={selected ? 3 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
      {draft && draftSource && (
        <>
          <path
            data-connection-preview=""
            d={getStyledConnectionPath(
              canvas.lineStyle,
              getConnectionPoint(draftSource, draft.source.side),
              draft.pointer,
              draft.source.side,
              draft.target?.side,
            )}
            stroke="var(--color-moss-deep)"
            strokeWidth={2}
            strokeDasharray={draft.target ? undefined : "5 4"}
            vectorEffect="non-scaling-stroke"
          />
          {draft.target && (
            <circle
              data-connection-snap=""
              cx={draft.pointer.x}
              cy={draft.pointer.y}
              r={9 / zoom}
              stroke="var(--color-moss-deep)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </>
      )}
    </svg>
  );
}
