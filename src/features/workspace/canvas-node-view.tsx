import { ArrowUpRightIcon } from "./icons";
import NodeFrame, { type NodeFrameProps } from "./node-frame";
import type { CanvasNode } from "./types";
import { canvasNodeTitle } from "./workspace-tree";

type CanvasNodeViewProps = Omit<NodeFrameProps, "node" | "children"> & {
  node: CanvasNode;
  onOpen: (nodeId: string) => void;
};

export default function CanvasNodeView({
  node,
  onOpen,
  ...frame
}: CanvasNodeViewProps) {
  const childCount = node.document.nodes.length;
  return (
    <NodeFrame {...frame} node={node}>
      <div className="flex min-h-0 flex-1 items-center justify-between gap-2 px-3">
        <span className="truncate text-xs text-lichen tabular-nums">
          {childCount > 0 ? `노드 ${childCount}개` : "비어 있음"}
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
