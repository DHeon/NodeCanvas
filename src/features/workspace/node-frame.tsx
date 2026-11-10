import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
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
    event: ReactPointerEvent<HTMLElement>,
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
  const label =
    node.type === "canvas_node"
      ? "캔버스"
      : node.type === "image_node"
        ? "이미지"
        : "텍스트";
  const placeholder = node.type === "text_node" ? "제목" : label;
  const [editingTitle, setEditingTitle] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const titleBar = useRef<HTMLElement>(null);
  const titleBeforeEdit = useRef(node.title);
  useEffect(() => {
    if (editingTitle) {
      titleInput.current?.focus({ preventScroll: true });
      titleInput.current?.select();
    }
  }, [editingTitle]);
  function editTitle() {
    titleBeforeEdit.current = node.title;
    onSelect(node.id);
    setEditingTitle(true);
  }
  return (
    <article
      tabIndex={-1}
      aria-label={`${label} 노드: ${node.title.trim() || "제목 없음"}${selected ? ", 선택됨" : ""}`}
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
      className={`group/node absolute flex flex-col rounded-xl border bg-white transition-[box-shadow,border-color] duration-150 outline-none ${selected ? "border-moss-deep shadow-card-selected" : "border-rule shadow-card hover:border-sage-hover hover:shadow-card-lift"}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.width,
        height: node.height,
        zIndex: selected ? 1 : 0,
      }}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit]">
        <header
          ref={titleBar}
          data-node-title-bar=""
          tabIndex={editingTitle ? -1 : 0}
          aria-label={`${label} 노드 제목 바`}
          title="드래그해서 이동 · 더블클릭으로 제목 편집 (Enter / F2)"
          onPointerDown={(event) => {
            if (
              event.target instanceof Element &&
              event.target.closest("input")
            )
              return;
            onDragStart(event, node);
          }}
          onDoubleClick={(event) => {
            if (event.button !== 0 || event.shiftKey || editingTitle) return;
            event.stopPropagation();
            editTitle();
          }}
          onFocus={(event) => {
            if (event.target === event.currentTarget) onSelect(node.id);
          }}
          onKeyDown={(event) => {
            if (
              !editingTitle &&
              (event.key === "Enter" || event.key === "F2")
            ) {
              event.preventDefault();
              event.stopPropagation();
              editTitle();
            }
          }}
          className="focus-visible:outline-inset flex h-12 shrink-0 cursor-grab touch-none items-center border-b border-rule-soft bg-card-head px-4 select-none focus-visible:outline-2 focus-visible:outline-moss-deep active:cursor-grabbing"
        >
          {editingTitle ? (
            <input
              ref={titleInput}
              aria-label={`${label} 노드 제목`}
              spellCheck={false}
              placeholder={placeholder}
              maxLength={200}
              value={node.title}
              onFocus={() => {
                onSelect(node.id);
                onEditStart();
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onBlur={() => {
                setEditingTitle(false);
                onEditEnd();
              }}
              onChange={(event) =>
                onChange(node.id, { title: event.target.value })
              }
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing || event.keyCode === 229)
                  return;
                if (event.key === "Enter" || event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  if (event.key === "Escape")
                    onChange(node.id, { title: titleBeforeEdit.current });
                  event.currentTarget.blur();
                  titleBar.current?.focus({ preventScroll: true });
                }
              }}
              className="min-w-0 flex-1 cursor-text touch-auto rounded bg-white px-1 text-sm font-medium outline-none select-text focus-visible:ring-2 focus-visible:ring-moss"
            />
          ) : (
            <span
              className={`min-w-0 flex-1 truncate text-sm font-medium ${node.title ? "" : "text-lichen"}`}
            >
              {node.title || placeholder}
            </span>
          )}
        </header>
        {children}
        <button
          type="button"
          aria-label={`${label} 노드 크기 조절`}
          title="드래그해서 크기 조절 · 키보드는 속성 패널의 W/H"
          tabIndex={-1}
          onPointerDown={(event) => onResizeStart(event, node)}
          onFocus={() => onSelect(node.id)}
          className="absolute right-2 bottom-2 z-10 grid h-5 w-5 cursor-nwse-resize touch-none place-items-center rounded bg-white/90 text-lichen select-none hover:bg-moss-wash hover:text-moss-deep focus-visible:outline-2 focus-visible:outline-moss-deep"
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
          // 포인터 전용 손잡이. 키보드 연결은 속성 패널의 "연결"에서 한다.
          tabIndex={-1}
          title={`${labels[side]} 연결점 · 다른 노드의 점 근처로 드래그해 연결`}
          onPointerDown={(event) => onConnectStart(event, node, side)}
          className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-crosshair touch-none rounded-full border-moss-deep select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep ${showPorts ? "block" : "hidden group-focus-within/node:block group-hover/node:block"} ${activePort === side ? "bg-moss-deep" : "bg-white hover:bg-moss-wash"}`}
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
