import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "./icons";
import {
  resolveTextStyle,
  TEXT_ALIGNS,
  TEXT_COLORS,
  TEXT_FONTS,
  TEXT_SIZES,
  type TextStyle,
} from "./text-style";

type SegmentOption = { key: string; label: string; content?: ReactNode };

/**
 * 글꼴 목록. 앞으로 글꼴이 늘어날 수 있어 칸 나눔 대신 펼치는 목록으로 둔다.
 * 각 항목은 그 글꼴로 미리 보여준다.
 */
function FontPicker({
  nodeId,
  value,
  onChange,
}: {
  nodeId: string;
  value: NonNullable<TextStyle["font"]>;
  onChange: (font: NonNullable<TextStyle["font"]>) => void;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const current =
    TEXT_FONTS.find((font) => font.key === value) ?? TEXT_FONTS[0];

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
    // 열리면 현재 글꼴 항목으로 포커스를 옮겨 방향키로 바로 고를 수 있게 한다.
    container.current
      ?.querySelector<HTMLInputElement>("input:checked")
      ?.focus({ preventScroll: true });
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <div
      ref={container}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        if (
          event.key === "Enter" &&
          open &&
          event.target instanceof HTMLInputElement
        ) {
          event.preventDefault();
          close();
        }
      }}
    >
      <span id={`${listId}-label`} className="mb-1.5 block text-xs text-lichen">
        글꼴
      </span>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${listId}-label ${listId}-value`}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-rule bg-white px-3 py-2 text-left text-bark hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep"
      >
        <span
          id={`${listId}-value`}
          className={`${current.className} text-[15px]`}
        >
          {current.label}
        </span>
        <ChevronDownIcon
          size={16}
          className={`shrink-0 text-lichen transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <fieldset
          id={listId}
          className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-rule bg-white p-1 shadow-card"
        >
          <legend className="sr-only">글꼴</legend>
          {TEXT_FONTS.map((font) => {
            const active = font.key === value;
            return (
              <label
                key={font.key}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-moss-deep ${active ? "bg-moss-wash text-bark" : "text-bark-soft hover:bg-mist"}`}
              >
                <input
                  type="radio"
                  name={`font-${nodeId}`}
                  value={font.key}
                  checked={active}
                  onChange={() => onChange(font.key)}
                  // 방향키로 고를 때도 click이 오므로(detail 0) 실제 마우스 클릭에서만 닫는다.
                  onClick={(event) => {
                    if (event.detail > 0) close();
                  }}
                  className="sr-only"
                />
                <span className={`${font.className} text-[15px]`}>
                  {font.label}
                </span>
                {active && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="text-moss-deep"
                  >
                    <path d="m5 12 5 5 9-10" />
                  </svg>
                )}
              </label>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}

/** 라디오 버튼을 붙인 칸 나눔 선택. 키보드 방향키로도 옮겨 다닌다. */
function Segmented({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string;
  legend: string;
  value: string;
  options: readonly SegmentOption[];
  onChange: (key: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs text-lichen">{legend}</legend>
      <div
        className="grid rounded-lg border border-rule bg-white p-0.5"
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
      >
        {options.map((option) => {
          const active = option.key === value;
          return (
            <label
              key={option.key}
              title={option.label}
              className={`flex min-h-8 cursor-pointer items-center justify-center rounded-md px-1 text-xs has-focus-visible:outline-2 has-focus-visible:outline-moss-deep ${active ? "bg-ink text-white" : "text-bark-soft hover:bg-mist"}`}
            >
              <input
                type="radio"
                name={name}
                value={option.key}
                checked={active}
                onChange={() => onChange(option.key)}
                aria-label={option.label}
                className="sr-only"
              />
              {option.content ?? option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const alignIcon = {
  left: "M4 6h16M4 12h10M4 18h13",
  center: "M4 6h16M7 12h10M5.5 18h13",
  right: "M4 6h16M10 12h10M7 18h13",
};

export default function TextStyleSection({
  nodeId,
  style,
  onChange,
  sectionClass,
  headingClass,
}: {
  nodeId: string;
  style: TextStyle | undefined;
  onChange: (nodeId: string, patch: TextStyle) => void;
  sectionClass: string;
  headingClass: string;
}) {
  const current = resolveTextStyle(style);
  const set = (patch: TextStyle) => onChange(nodeId, patch);
  return (
    <section className={sectionClass}>
      <h3 className={headingClass}>글자 스타일</h3>
      <FontPicker
        nodeId={nodeId}
        value={current.font.key}
        onChange={(font) => set({ font })}
      />
      <Segmented
        name={`size-${nodeId}`}
        legend="크기"
        value={current.size.key}
        options={TEXT_SIZES.map((size, index) => ({
          key: size.key,
          label: size.label,
          // 글자로 쓰면 좁은 칸에서 줄이 바뀌므로 크기가 커지는 "가"로 보여준다.
          content: (
            <span
              aria-hidden="true"
              className="leading-none font-medium"
              style={{ fontSize: [12, 14, 17, 21][index] }}
            >
              가
            </span>
          ),
        }))}
        onChange={(size) => set({ size: size as TextStyle["size"] })}
      />
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <Segmented
            name={`align-${nodeId}`}
            legend="정렬"
            value={current.align.key}
            options={TEXT_ALIGNS.map((align) => ({
              key: align.key,
              label: align.label,
              content: (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d={alignIcon[align.key]} />
                </svg>
              ),
            }))}
            onChange={(align) => set({ align: align as TextStyle["align"] })}
          />
        </div>
        <button
          type="button"
          aria-pressed={current.bold}
          onClick={() => set({ bold: !current.bold })}
          title="굵게"
          className={`grid h-9 w-11 shrink-0 place-items-center rounded-lg border text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep ${current.bold ? "border-ink bg-ink text-white" : "border-rule bg-white text-bark-soft hover:bg-mist"}`}
        >
          <span aria-hidden="true">B</span>
          <span className="sr-only">굵게</span>
        </button>
      </div>
      <fieldset>
        <legend className="mb-2 text-xs text-lichen">
          글자 색 · {current.color.label}
        </legend>
        <div className="flex flex-wrap gap-2">
          {TEXT_COLORS.map((color) => (
            <label
              key={color.key}
              title={color.label}
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-full has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-moss-deep"
            >
              <input
                type="radio"
                name={`text-color-${nodeId}`}
                value={color.key}
                checked={current.color.key === color.key}
                onChange={() => set({ color: color.key })}
                aria-label={color.label}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`h-6 w-6 rounded-full ${current.color.key === color.key ? "ring-2 ring-bark ring-offset-2 ring-offset-paper" : ""}`}
                style={{ backgroundColor: color.value }}
              />
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
