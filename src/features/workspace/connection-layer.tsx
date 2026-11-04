import { getConnectionPath, getConnectionPoint } from "./connections";
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
        const path = getConnectionPath(
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
              aria-label={`${source.title || "제목 없는 노드"} ↔ ${target.title || "제목 없는 노드"} 연결선`}
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
            <path
              data-connection-id={connection.id}
              d={path}
              stroke={selected ? "#2563eb" : "#8b5cf6"}
              strokeWidth={selected ? 3 : 2}
              vectorEffect="non-scaling-stroke"
              className="group-focus-within/connection:stroke-blue-600 group-hover/connection:stroke-blue-600"
            />
          </g>
        );
      })}
      {draft && draftSource && (
        <>
          <path
            data-connection-preview=""
            d={getConnectionPath(
              getConnectionPoint(draftSource, draft.source.side),
              draft.pointer,
              draft.source.side,
              draft.target?.side,
            )}
            stroke="#8b5cf6"
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
              stroke="#8b5cf6"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </>
      )}
    </svg>
  );
}
