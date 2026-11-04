import NodeFrame, { type NodeFrameProps } from "./node-frame";
import type { TextNode } from "./types";

type TextNodeViewProps = Omit<NodeFrameProps, "node" | "children"> & {
  node: TextNode;
};

export default function TextNodeView({ node, ...frame }: TextNodeViewProps) {
  return (
    <NodeFrame {...frame} node={node}>
      <textarea
        aria-label="텍스트 노드 내용"
        spellCheck={false}
        placeholder="내용을 입력하세요"
        maxLength={50000}
        value={node.text}
        onFocus={() => {
          frame.onSelect(node.id);
          frame.onEditStart();
        }}
        onBlur={frame.onEditEnd}
        onChange={(event) =>
          frame.onChange(node.id, { text: event.target.value })
        }
        className="min-h-0 w-full flex-1 resize-none overflow-y-auto overscroll-contain p-4 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-inset"
      />
    </NodeFrame>
  );
}
