"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

type NodeContextMenuProps = {
  /** 뷰포트 기준 위치. */
  left: number;
  top: number;
  canUngroup: boolean;
  onGroup: () => void;
  onUngroup: () => void;
  onClose: () => void;
};

const EDGE_GAP = 8;

/** 노드 우클릭(또는 메뉴 키) 메뉴. 지금은 그룹화·그룹화 해제. */
export default function NodeContextMenu({
  left,
  top,
  canUngroup,
  onGroup,
  onUngroup,
  onClose,
}: NodeContextMenuProps) {
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
    menu
      .querySelector<HTMLButtonElement>("[role='menuitem']")
      ?.focus({ preventScroll: true });
  }, [left, top]);

  // 메뉴 밖을 누르거나 휠을 굴리면 닫는다.
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

  const items = [
    { label: "그룹화", hint: "G", run: onGroup },
    ...(canUngroup
      ? [{ label: "그룹화 해제", hint: "Shift+G", run: onUngroup }]
      : []),
  ];

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="노드 메뉴"
      className="absolute z-40 w-48 rounded-xl border border-rule bg-white p-1.5 shadow-float"
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
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
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            item.run();
            onClose();
          }}
          className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-bark outline-none hover:bg-mist focus-visible:bg-moss-wash"
        >
          {item.label}
          <kbd className="font-sans text-xs text-lichen">{item.hint}</kbd>
        </button>
      ))}
    </div>
  );
}
