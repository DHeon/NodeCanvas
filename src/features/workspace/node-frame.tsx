import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { CONNECTION_SIDES } from "./connections";
import type {
  ConnectionSide,
  TextNodeContentPatch,
  WorkspaceNode,
} from "./types";

const positions = {
  top: { left: "50%", top: "0%" },
  right: { left: "100%", top: "50%" },
  bottom: { left: "50%", top: "100%" },
  left: { left: "0%", top: "50%" },
};
const labels = { top: "위쪽", right: "오른쪽", bottom: "아래쪽", left: "왼쪽" };

export type NodeFrameProps = {
  node: WorkspaceNode;
  selected: boolean;
  zoom: number;
  showPorts: boolean;
  activePort: ConnectionSide | null;
  onConnectStart: (
    event: ReactPointerEvent<HTMLButtonElement>,
    node: WorkspaceNode,
    side: ConnectionSide,
  ) => void;
  onSelect: (nodeId: string, additive?: boolean) => void;
  onDragStart: (
    event: ReactPointerEvent<HTMLButtonElement>,
    node: WorkspaceNode,
  ) => void;
  onResizeStart: (
    event: ReactPointerEvent<HTMLButtonElement>,
    node: WorkspaceNode,
  ) => void;
  onChange: (nodeId: string, patch: TextNodeContentPatch) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  children: ReactNode;
};

export default function NodeFrame({
  node,
  selected,
  zoom,
  showPorts,
  activePort,
  onConnectStart,
  onSelect,
  onDragStart,
  onResizeStart,
  onChange,
  onEditStart,
  onEditEnd,
  children,
}: NodeFrameProps) {
  const label = node.type === "image_node" ? "이미지" : "텍스트";
  return (
    <article
      tabIndex={-1}
      data-node-id={node.id}
      data-node-type={node.type}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        if (event.shiftKey) event.preventDefault();
        if (
          !(event.target instanceof Element) ||
          !event.target.closest(
            "input, textarea, button, [contenteditable='true']",
          )
        ) {
          event.currentTarget.focus({ preventScroll: true });
        }
        onSelect(node.id, event.shiftKey);
      }}
      className={`group/node absolute flex flex-col rounded-2xl border bg-white shadow-sm outline-none ${selected ? "border-blue-500 ring-2 ring-blue-200" : "border-neutral-300"}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.width,
        height: node.height,
        zIndex: selected ? 1 : 0,
      }}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit]">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3">
          <button
            type="button"
            aria-label={`${label} 노드 이동`}
            title="드래그해서 이동"
            onPointerDown={(event) => onDragStart(event, node)}
            onFocus={() => onSelect(node.id)}
            className="shrink-0 cursor-grab touch-none rounded px-1 text-neutral-500 select-none hover:bg-neutral-200 active:cursor-grabbing"
          >
            ⠿
          </button>
          <input
            aria-label={`${label} 노드 제목`}
            placeholder={label === "이미지" ? "이미지" : "제목"}
            maxLength={200}
            value={node.title}
            onFocus={() => {
              onSelect(node.id);
              onEditStart();
            }}
            onBlur={onEditEnd}
            onChange={(event) =>
              onChange(node.id, { title: event.target.value })
            }
            className="min-w-0 flex-1 rounded bg-transparent px-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          />
        </header>
        {children}
        <button
          type="button"
          aria-label={`${label} 노드 크기 조절`}
          title="드래그해서 크기 조절"
          onPointerDown={(event) => onResizeStart(event, node)}
          onFocus={() => onSelect(node.id)}
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
      </div>
      {CONNECTION_SIDES.map((side) => (
        <button
          key={side}
          type="button"
          data-connection-side={side}
          aria-label={`${labels[side]} 연결점`}
          title={`${labels[side]} 연결점 · 다른 노드의 점 근처로 드래그해 연결`}
          onPointerDown={(event) => onConnectStart(event, node, side)}
          className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-crosshair touch-none rounded-full border-violet-500 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 ${showPorts ? "block" : "hidden group-focus-within/node:block group-hover/node:block"} ${activePort === side ? "bg-violet-500" : "bg-white hover:bg-violet-100"}`}
          style={{
            ...positions[side],
            width: 8 / zoom,
            height: 8 / zoom,
            borderWidth: 2 / zoom,
          }}
        />
      ))}
    </article>
  );
}
