import { ArrowUpRightIcon } from "./icons";
import NodeFrame, { type NodeFrameProps } from "./node-frame";
import type { CanvasNode } from "./types";
import { canvasNodeTitle } from "./workspace-tree";

type CanvasNodeViewProps = Omit<NodeFrameProps, "node" | "children"> & {
  node: CanvasNode;
  onOpen: (nodeId: string) => void;
  /** 검색 중 이 캔버스 안(모든 깊이)에 있는 결과 수. */
  searchCount?: number;
};

export default function CanvasNodeView({
  node,
  onOpen,
  searchCount = 0,
  ...frame
}: CanvasNodeViewProps) {
  const childCount = node.document.nodes.length;
  return (
    <NodeFrame {...frame} node={node}>
      <div className="flex min-h-0 flex-1 items-center justify-between gap-2 px-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs text-lichen tabular-nums">
            {childCount > 0 ? `노드 ${childCount}개` : "비어 있음"}
          </span>
          {searchCount > 0 && (
            <span
              data-search-count=""
              className="shrink-0 rounded-full bg-moss-wash px-2 py-0.5 text-xs font-medium text-bark-soft tabular-nums"
            >
              {searchCount}개 찾음
            </span>
          )}
        </span>
        <button
          type="button"
          aria-label={`${canvasNodeTitle(node)} 열기`}
          onClick={() => onOpen(node.id)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-mist px-3 py-2 text-xs font-medium text-bark-soft hover:bg-mist-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep active:bg-rule"
        >
          열기
          <ArrowUpRightIcon size={14} />
        </button>
      </div>
    </NodeFrame>
  );
}
