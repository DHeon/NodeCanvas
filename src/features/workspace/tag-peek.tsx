"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { connectionColor } from "./connection-colors";
import { SearchIcon } from "./icons";
import type { TagDefinition } from "./types";

const MAX_TAG_DOTS = 3;
const OPEN_DELAY = 120;
const CLOSE_DELAY = 140;
const GAP = 8;

type TagPeekProps = {
  tags: TagDefinition[];
  /** 태그를 누르면 그 태그가 붙은 노드를 모아 본다. 없으면 이름만 보여준다. */
  onLens?: (tag: TagDefinition) => void;
};

/**
 * 노드 머리의 태그 점 묶음. 가리키거나 포커스하면 화면 위에 작은 카드로 태그 이름을 보여준다.
 * 카드는 캔버스 확대와 무관하게 같은 크기로 떠서 축소 화면에서도 읽힌다.
 */
export default function TagPeek({ tags, onLens }: TagPeekProps) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const focusFirstRef = useRef(false);
  const cardId = useId();
  const names = tags.map((tag) => tag.name).join(", ");

  function schedule(next: boolean, delay: number) {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOpen(next), delay);
  }
  function close(returnFocus = false) {
    window.clearTimeout(timerRef.current);
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
  }
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  // 점 묶음 바로 아래, 점의 왼쪽 끝에서 오른쪽으로 펼친다. 화면 밖으로 나가면 안쪽으로 당기고,
  // 아래 자리가 모자라면 위로 뒤집는다.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const card = cardRef.current;
    if (!trigger || !card) return;
    const rect = trigger.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = card;
    const below = rect.bottom + GAP + height <= window.innerHeight - GAP;
    const left = Math.max(
      GAP,
      Math.min(rect.left - 6, window.innerWidth - width - GAP),
    );
    setPlace({
      left,
      top: below ? rect.bottom + GAP : Math.max(GAP, rect.top - GAP - height),
      // 점이 있는 쪽에서 피어나도록 변형 기준점을 점 위치에 둔다.
      transformOrigin: `${Math.round(rect.left + rect.width / 2 - left)}px ${below ? "top" : "bottom"}`,
    });
  }, [open]);

  // 키보드로 열었으면 자리를 잡아 보이게 된 뒤 첫 태그로 포커스를 옮긴다(숨긴 요소는 포커스를 못 받는다).
  useEffect(() => {
    if (!place || !focusFirstRef.current) return;
    focusFirstRef.current = false;
    cardRef.current
      ?.querySelector<HTMLElement>("button")
      ?.focus({ preventScroll: true });
  }, [place]);

  // 캔버스를 움직이거나 다른 곳을 누르면 카드가 점에서 떨어지므로 닫는다.
  useEffect(() => {
    if (!open) return;
    function dismiss(event: Event) {
      const target = event.target;
      if (
        target instanceof Node &&
        (cardRef.current?.contains(target) ||
          triggerRef.current?.contains(target))
      )
        return;
      close();
    }
    document.addEventListener("pointerdown", dismiss, true);
    window.addEventListener("wheel", dismiss, { capture: true, passive: true });
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      window.removeEventListener("wheel", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-tag-peek=""
        aria-label={`태그 ${tags.length}개: ${names}`}
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        // 빈 title로 머리("드래그해서 이동…")의 기본 툴팁을 물려받지 않는다.
        title=""
        // 점 묶음을 잡아도 노드를 끌거나 선택하지 않는다.
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onPointerEnter={() => schedule(true, OPEN_DELAY)}
        onPointerLeave={() => schedule(false, CLOSE_DELAY)}
        onClick={() => {
          window.clearTimeout(timerRef.current);
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            close();
          } else if (
            event.key === "ArrowDown" ||
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            event.stopPropagation();
            focusFirstRef.current = true;
            if (open)
              cardRef.current
                ?.querySelector<HTMLElement>("button")
                ?.focus({ preventScroll: true });
            else setOpen(true);
          }
        }}
        className="group/peek ml-2 flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-1.5 py-1 transition-[gap,background-color] duration-200 ease-out hover:gap-1.5 hover:bg-mist focus-visible:outline-2 focus-visible:outline-moss-deep aria-expanded:gap-1.5 aria-expanded:bg-mist motion-reduce:transition-none"
      >
        {tags.slice(0, MAX_TAG_DOTS).map((tag) => (
          <span
            key={tag.id}
            aria-hidden="true"
            data-tag-dot=""
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: connectionColor(tag.color).value }}
          />
        ))}
        {tags.length > MAX_TAG_DOTS && (
          <span aria-hidden="true" className="text-xs text-lichen tabular-nums">
            +{tags.length - MAX_TAG_DOTS}
          </span>
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={cardRef}
            id={cardId}
            role="group"
            aria-label="이 노드의 태그"
            onPointerEnter={() => schedule(true, 0)}
            onPointerLeave={() => schedule(false, CLOSE_DELAY)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close(true);
                return;
              }
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              event.preventDefault();
              const items = [
                ...(cardRef.current?.querySelectorAll<HTMLElement>("button") ??
                  []),
              ];
              const index = items.indexOf(
                document.activeElement as HTMLElement,
              );
              const step = event.key === "ArrowDown" ? 1 : -1;
              items[(index + step + items.length) % items.length]?.focus();
            }}
            onBlur={(event) => {
              const next = event.relatedTarget;
              if (
                !(next instanceof Node) ||
                (!cardRef.current?.contains(next) &&
                  !triggerRef.current?.contains(next))
              )
                close();
            }}
            className="tag-peek fixed z-50 w-max max-w-64 min-w-40 rounded-xl border border-rule bg-white p-1.5 shadow-float"
            // 자리를 재기 전 한 프레임은 보이지 않게 둔다.
            style={place ?? { visibility: "hidden", top: 0, left: 0 }}
          >
            <ul className="max-h-64 overflow-y-auto">
              {tags.map((tag) => {
                const dot = (
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: connectionColor(tag.color).value,
                    }}
                  />
                );
                return (
                  <li key={tag.id}>
                    {onLens ? (
                      <button
                        type="button"
                        aria-label={`"${tag.name}" 태그가 붙은 노드 모아 보기`}
                        onClick={() => {
                          close();
                          onLens(tag);
                        }}
                        className="group/item flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-bark outline-none hover:bg-moss-wash focus-visible:bg-moss-wash"
                      >
                        {dot}
                        <span className="min-w-0 flex-1 truncate">
                          {tag.name}
                        </span>
                        <SearchIcon
                          size={14}
                          className="shrink-0 text-lichen opacity-0 transition-opacity duration-150 group-hover/item:opacity-100 group-focus-visible/item:opacity-100"
                        />
                      </button>
                    ) : (
                      <span className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-bark">
                        {dot}
                        <span className="min-w-0 truncate">{tag.name}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {onLens && (
              <p className="mt-1 border-t border-rule-soft px-2.5 pt-1.5 pb-0.5 text-xs text-lichen">
                눌러서 이 태그 노드만 모아 보기
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
