"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/** 메뉴 항목 하나, 또는 구분선. */
export type ContextMenuEntry =
  | {
      id: string;
      label: string;
      /** 오른쪽에 흐리게 보이는 단축키 글. */
      shortcut?: string;
      disabled?: boolean;
    }
  | "separator";

type NodeContextMenuProps = {
  /** 뷰포트 기준 위치. */
  left: number;
  top: number;
  /** 화면 읽기용 메뉴 이름. */
  label: string;
  items: ContextMenuEntry[];
  /** 항목을 눌렀을 때(닫기 전에 부른다). */
  onSelect: (id: string) => void;
  onClose: () => void;
  /**
   * true면 열 때 포커스를 가져오지 않는다(글자 메뉴). 글 칸이 포커스를 잃으면
   * 브라우저가 드래그한 선택 표시를 지우기 때문. 화살표 키를 누르면 그때 메뉴로 옮긴다.
   */
  keepFocus?: boolean;
};

const EDGE_GAP = 8;
const ENABLED_ITEM = "[role='menuitem']:not(:disabled)";

/** 작업영역 우클릭(또는 메뉴 키) 메뉴. 항목은 우클릭한 자리에 따라 달라진다. */
export default function NodeContextMenu({
  left,
  top,
  label,
  items,
  onSelect,
  onClose,
  keepFocus = false,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 뷰포트 밖으로 넘치면 안쪽으로 당기고, 누를 수 있는 첫 항목에 포커스를 둔다.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const parent = menu?.offsetParent;
    if (!menu || !(parent instanceof HTMLElement)) return;
    const maxLeft = parent.clientWidth - menu.offsetWidth - EDGE_GAP;
    const maxTop = parent.clientHeight - menu.offsetHeight - EDGE_GAP;
    menu.style.left = `${Math.max(EDGE_GAP, Math.min(left, maxLeft))}px`;
    menu.style.top = `${Math.max(EDGE_GAP, Math.min(top, maxTop))}px`;
    if (keepFocus) return;
    (menu.querySelector<HTMLButtonElement>(ENABLED_ITEM) ?? menu).focus({
      preventScroll: true,
    });
  }, [left, top, keepFocus]);

  // 포커스를 글 칸에 둔 채 열렸을 때: 화살표는 메뉴로 포커스를 옮기고, Esc는 닫고,
  // 다른 키(글자 입력 등)는 메뉴를 닫고 글 칸으로 그대로 보낸다.
  useEffect(() => {
    if (!keepFocus) return;
    function onKey(event: KeyboardEvent) {
      const menu = menuRef.current;
      if (!menu || menu.contains(document.activeElement)) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        const buttons = menu.querySelectorAll<HTMLButtonElement>(ENABLED_ITEM);
        buttons[event.key === "ArrowDown" ? 0 : buttons.length - 1]?.focus();
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (!["Shift", "Control", "Alt", "Meta"].includes(event.key)) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [keepFocus, onClose]);

  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  // 메뉴 밖을 누르거나, 휠(돌리기·가운데 버튼 끌기)로 화면을 움직이면 닫는다. 휠은 메뉴 위에서도 닫는다.
  // 화면 끌기가 시작되며 다시 그려질 때 이벤트 처리 중에 리스너가 바뀌면 그 이벤트를 놓치므로 한 번만 단다.
  useEffect(() => {
    function dismiss(event: Event) {
      if (
        event instanceof PointerEvent &&
        event.button !== 1 &&
        event.target instanceof Node &&
        menuRef.current?.contains(event.target)
      )
        return;
      close.current();
    }
    document.addEventListener("pointerdown", dismiss, true);
    window.addEventListener("wheel", dismiss, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      window.removeEventListener("wheel", dismiss, true);
    };
  }, []);

  function move(step: number) {
    const buttons = [
      ...(menuRef.current?.querySelectorAll<HTMLButtonElement>(ENABLED_ITEM) ??
        []),
    ];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(index + step + buttons.length) % buttons.length]?.focus();
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      tabIndex={-1}
      className="chrome-no-select absolute z-40 w-52 rounded-xl border border-rule bg-white p-1.5 shadow-float outline-none"
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
      // 글자 메뉴는 항목을 눌러도 글 칸의 포커스·선택이 그대로 남게 한다.
      onMouseDown={(event) => {
        if (keepFocus) event.preventDefault();
      }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        // 메뉴 안의 키는 캔버스 단축키로 새지 않게 한다.
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          move(1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          move(-1);
        }
      }}
    >
      {items.map((item, index) =>
        item === "separator" ? (
          <div
            key={`separator-${index}`}
            role="separator"
            className="mx-1.5 my-1 h-px bg-rule"
          />
        ) : (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onSelect(item.id);
              onClose();
            }}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-bark outline-none hover:bg-mist focus-visible:bg-moss-wash disabled:text-lichen disabled:hover:bg-transparent"
          >
            {item.label}
            {item.shortcut && (
              <kbd className="font-sans text-xs text-lichen">
                {item.shortcut}
              </kbd>
            )}
          </button>
        ),
      )}
    </div>
  );
}
