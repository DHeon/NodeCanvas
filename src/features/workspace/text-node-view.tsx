import type { PointerEvent as ReactPointerEvent } from "react";
import type { TextNode, TextNodeContentPatch } from "./types";

type TextNodeViewProps = {
  node: TextNode;
  selected: boolean;
  onSelect: (nodeId: string) => void;
  onDragStart: (
    event: ReactPointerEvent<HTMLButtonElement>,
    node: TextNode,
  ) => void;
  onChange: (nodeId: string, patch: TextNodeContentPatch) => void;
  onResizeStart: (
    event: ReactPointerEvent<HTMLButtonElement>,
    node: TextNode,
  ) => void;
};

export default function TextNodeView({
  node,
  selected,
  onSelect,
  onDragStart,
  onResizeStart,
  onChange,
}: TextNodeViewProps) {
  return (
    <article
      data-node-id={node.id}
      onPointerDown={(event) => {
        if (event.button === 0) onSelect(node.id);
      }}
      onFocus={() => onSelect(node.id)}
      className={`absolute flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${
        selected ? "border-blue-500 ring-2 ring-blue-200" : "border-neutral-300"
      }`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.width,
        height: node.height,
        zIndex: selected ? 1 : 0,
      }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50 p-3">
        <button
          type="button"
          aria-label="텍스트 노드 이동"
          title="드래그해서 이동"
          onPointerDown={(event) => onDragStart(event, node)}
          className="shrink-0 cursor-grab touch-none rounded px-1 text-neutral-500 select-none hover:bg-neutral-200 active:cursor-grabbing"
        >
          ⠿
        </button>
        <input
          aria-label="텍스트 노드 제목"
          placeholder="제목"
          value={node.title}
          onChange={(event) => {
            onChange(node.id, { title: event.target.value });
          }}
          className="min-w-0 flex-1 rounded bg-transparent px-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        />
      </header>

      <textarea
        aria-label="텍스트 노드 내용"
        placeholder="내용을 입력하세요"
        value={node.text}
        onChange={(event) => {
          onChange(node.id, { text: event.target.value });
        }}
        className="min-h-0 w-full flex-1 resize-none overflow-y-auto overscroll-contain p-4 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-inset"
      />
      <button
        type="button"
        aria-label="텍스트 노드 크기 조절"
        title="드래그해서 크기 조절"
        onPointerDown={(event) => onResizeStart(event, node)}
        className="absolute right-2 bottom-2 z-10 grid h-5 w-5 cursor-nwse-resize touch-none place-items-center rounded bg-white/90 text-neutral-500 select-none hover:bg-blue-100 hover:text-blue-600"
      >
        <svg
          viewBox="0 0 16 16"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M5 12 12 5M9 12l3-3" />
        </svg>
      </button>
    </article>
  );
}
