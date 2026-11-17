"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import {
  CanvasIcon,
  ChecklistIcon,
  ImageIcon,
  LinkIcon,
  TextIcon,
} from "./icons";
import type { WorkspaceNode } from "./types";

type ConnectNodeMenuProps = {
  /** 뷰포트 기준 위치(놓은 자리). */
  left: number;
  top: number;
  canvasDisabled: boolean;
  onPick: (type: WorkspaceNode["type"]) => void;
  onClose: () => void;
};

const ITEMS = [
  { type: "text_node", label: "텍스트", key: "t", Icon: TextIcon },
  { type: "image_node", label: "이미지", key: "i", Icon: ImageIcon },
  { type: "canvas_node", label: "캔버스", key: "c", Icon: CanvasIcon },
  { type: "link_node", label: "링크", key: "l", Icon: LinkIcon },
  {
    type: "checklist_node",
    label: "체크리스트",
    key: "k",
    Icon: ChecklistIcon,
  },
] as const;

const EDGE_GAP = 8;

/** 연결선을 빈 곳에 놓았을 때 그 자리에 뜨는 노드 종류 메뉴. */
export default function ConnectNodeMenu({
  left,
  top,
  canvasDisabled,
  onPick,
  onClose,
}: ConnectNodeMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 뷰포트 밖으로 넘치면 안쪽으로 당기고, 첫 항목에 포커스를 둔다.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const parent = menu?.offsetParent;
    if (!menu || !(parent instanceof HTMLElement)) return;
    const maxLeft = parent.clientWidth - menu.offsetWidth - EDGE_GAP;
    const maxTop = parent.clientHeight - menu.offsetHeight - EDGE_GAP;
    menu.style.left = `${Math.max(EDGE_GAP, Math.min(left, maxLeft))}px`;
    menu.style.top = `${Math.max(EDGE_GAP, Math.min(top, maxTop))}px`;
    menu.querySelector<HTMLButtonElement>("[role='menuitem']")?.focus({
      preventScroll: true,
    });
  }, [left, top]);

  // 메뉴 밖을 누르거나 화면을 휠로 움직이면 닫는다.
  useEffect(() => {
    function dismiss(event: Event) {
      if (
        event.target instanceof Node &&
        menuRef.current?.contains(event.target)
      )
        return;
      onClose();
    }
    document.addEventListener("pointerdown", dismiss, true);
    window.addEventListener("wheel", dismiss, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      window.removeEventListener("wheel", dismiss, true);
    };
  }, [onClose]);

  function move(step: number) {
    const items = [
      ...(menuRef.current?.querySelectorAll<HTMLButtonElement>(
        "[role='menuitem']",
      ) ?? []),
    ];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(index + step + items.length) % items.length]?.focus();
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="이어서 만들 노드"
      className="absolute z-40 w-44 rounded-xl border border-rule bg-white p-1.5 shadow-float"
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        // 메뉴 안의 키는 캔버스 단축키(T로 노드 추가 등)로 새지 않게 한다.
        event.stopPropagation();
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          move(1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          move(-1);
        } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
          const item = ITEMS.find(
            (candidate) => candidate.key === event.key.toLowerCase(),
          );
          if (item) {
            event.preventDefault();
            onPick(item.type);
          }
        }
      }}
    >
      <p className="px-2 pt-1 pb-1.5 text-xs text-lichen">이어서 만들기</p>
      {ITEMS.map(({ type, label, key, Icon }) => {
        const disabled = type === "canvas_node" && canvasDisabled;
        return (
          <button
            key={type}
            type="button"
            role="menuitem"
            // 눌러도 이유를 알려주도록 disabled 대신 aria-disabled를 쓴다.
            aria-disabled={disabled || undefined}
            title={
              disabled
                ? "이 공간에는 캔버스 노드를 더 넣을 수 없어요."
                : undefined
            }
            onClick={() => onPick(type)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-bark outline-none hover:bg-mist focus-visible:bg-moss-wash aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
          >
            <Icon size={18} className="shrink-0 text-bark-soft" />
            <span className="flex-1">{label}</span>
            <kbd className="font-sans text-xs text-lichen uppercase">{key}</kbd>
          </button>
        );
      })}
    </div>
  );
}
