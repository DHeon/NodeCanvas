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
  return (
    <NodeFrame {...frame} node={node}>
      <div className="flex min-h-0 flex-1 items-center justify-between gap-2 px-3">
        <span className="truncate text-xs text-neutral-500">
          하위 작업 공간
        </span>
        <button
          type="button"
          aria-label={`${canvasNodeTitle(node)} 열기`}
          onClick={() => onOpen(node.id)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-neutral-800 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
        >
          열기 <span aria-hidden="true">↗</span>
        </button>
      </div>
    </NodeFrame>
  );
}
