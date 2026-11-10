"use client";

import { useEffect, useRef, useState } from "react";

const groups: { title: string; items: [string, string][] }[] = [
  {
    title: "만들기",
    items: [
      ["T", "텍스트 노드 추가"],
      ["I", "이미지 노드 추가"],
      ["C", "캔버스 노드 추가"],
      ["Ctrl + V", "이미지 붙여넣기"],
      ["Ctrl + D", "선택한 노드 복제"],
    ],
  },
  {
    title: "선택·편집",
    items: [
      ["Ctrl + A", "모두 선택"],
      ["방향키", "선택한 노드 이동 (Shift: 크게)"],
      ["Enter / F2", "노드 제목 편집"],
      ["Delete", "선택 삭제"],
      ["Ctrl + Z / Ctrl + Y", "실행 취소 / 다시 실행"],
      ["Ctrl + S", "지금 저장"],
    ],
  },
  {
    title: "화면",
    items: [
      ["Space + 드래그", "화면 이동"],
      ["두 손가락 스크롤", "화면 이동 (트랙패드)"],
      ["Ctrl + 휠 / 핀치", "확대·축소"],
      ["+ / − / 0", "확대 / 축소 / 화면 맞춤"],
      ["Alt + ↑", "상위 작업 공간으로"],
    ],
  },
];

/** 헤더의 "?" 버튼: 키보드·마우스 조작을 한곳에 모아 보여준다. */
export default function ShortcutHelp({
  buttonClassName,
}: {
  buttonClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      )
        setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  return (
    <div
      ref={container}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="shortcut-help"
        aria-label="단축키와 조작 방법"
        title="단축키와 조작 방법"
        onClick={() => setOpen((value) => !value)}
        className={buttonClassName}
      >
        <span aria-hidden="true" className="text-sm font-semibold">
          ?
        </span>
      </button>
      {open && (
        <section
          id="shortcut-help"
          aria-label="단축키와 조작 방법"
          className="absolute top-full right-0 z-50 mt-2 w-[min(340px,calc(100vw-32px))] rounded-xl border border-rule bg-white p-4 text-sm shadow-float"
        >
          {groups.map((group) => (
            <div key={group.title} className="not-first:mt-4">
              <h2 className="mb-2 text-xs font-semibold text-bark-soft">
                {group.title}
              </h2>
              <dl className="space-y-1.5">
                {group.items.map(([keys, label]) => (
                  <div
                    key={keys}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <dt className="text-bark">{label}</dt>
                    <dd className="shrink-0 rounded-md bg-mist px-1.5 py-0.5 font-mono text-xs text-bark-soft">
                      {keys}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
