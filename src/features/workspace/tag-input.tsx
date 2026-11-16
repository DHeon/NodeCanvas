"use client";

import { useId, useState } from "react";
import {
  CONNECTION_COLORS,
  connectionColor,
  type ConnectionColor,
} from "./connection-colors";
import { CloseIcon } from "./icons";
import type { TagDefinition } from "./types";

type AppliedTag = { tag: TagDefinition; partial: boolean };

type TagInputProps = {
  allTags: TagDefinition[];
  applied: AppliedTag[];
  onAdd: (name: string) => void;
  onFill: (tagId: string) => void;
  onRemove: (tagId: string) => void;
  onRecolor: (tagId: string, color: ConnectionColor) => void;
};

const MAX_SUGGESTIONS = 8;

/** 붙은 태그 칩 + 자동완성 입력 + 칩 색 바꾸기. 하나·여러 노드 선택에서 함께 쓴다. */
export default function TagInput({
  allTags,
  applied,
  onAdd,
  onFill,
  onRemove,
  onRecolor,
}: TagInputProps) {
  const [value, setValue] = useState("");
  const [active, setActive] = useState(0);
  const [paletteFor, setPaletteFor] = useState<string | null>(null);
  const listId = useId();

  const query = value.trim().replace(/^#+/, "").toLowerCase();
  const fullyApplied = new Set(
    applied.filter((item) => !item.partial).map((item) => item.tag.id),
  );
  const suggestions = query
    ? allTags
        .filter(
          (tag) =>
            !fullyApplied.has(tag.id) && tag.name.toLowerCase().includes(query),
        )
        .slice(0, MAX_SUGGESTIONS)
    : [];
  const paletteTag = applied.find((item) => item.tag.id === paletteFor)?.tag;

  function submit(name: string) {
    if (!name.trim()) return;
    onAdd(name);
    setValue("");
    setActive(0);
  }

  return (
    <div className="space-y-2">
      {applied.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="붙은 태그">
          {applied.map(({ tag, partial }) => (
            <li
              key={tag.id}
              className={`flex items-center rounded-full border border-rule bg-white text-xs text-bark ${partial ? "opacity-50" : ""}`}
            >
              <button
                type="button"
                onClick={() =>
                  partial
                    ? onFill(tag.id)
                    : setPaletteFor((current) =>
                        current === tag.id ? null : tag.id,
                      )
                }
                title={
                  partial
                    ? "선택한 나머지 노드에도 붙이기"
                    : "눌러서 태그 색 바꾸기"
                }
                aria-expanded={partial ? undefined : paletteFor === tag.id}
                className="flex items-center gap-1.5 rounded-l-full py-1 pr-1 pl-2 hover:bg-mist focus-visible:outline-2 focus-visible:outline-moss-deep"
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: connectionColor(tag.color).value }}
                />
                {tag.name}
              </button>
              <button
                type="button"
                onClick={() => onRemove(tag.id)}
                aria-label={`${tag.name} 태그 떼기`}
                title="태그 떼기"
                className="grid place-items-center rounded-r-full py-1 pr-2 pl-1 text-lichen hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-600"
              >
                <CloseIcon size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {paletteTag && (
        <fieldset
          className="rounded-lg border border-rule bg-white p-2"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setPaletteFor(null);
            }
          }}
        >
          <legend className="sr-only">{paletteTag.name} 태그 색</legend>
          <div className="flex flex-wrap gap-1.5">
            {CONNECTION_COLORS.map((color) => (
              <label
                key={color.key}
                title={color.label}
                className="grid h-7 w-7 cursor-pointer place-items-center rounded-full has-focus-visible:outline-2 has-focus-visible:outline-moss-deep"
              >
                <input
                  type="radio"
                  name={`tag-color-${paletteTag.id}`}
                  checked={paletteTag.color === color.key}
                  onChange={() => {
                    onRecolor(paletteTag.id, color.key);
                    setPaletteFor(null);
                  }}
                  aria-label={color.label}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`h-5 w-5 rounded-full ${paletteTag.color === color.key ? "ring-2 ring-bark ring-offset-2 ring-offset-white" : ""}`}
                  style={{ backgroundColor: color.value }}
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="relative">
        <input
          type="text"
          value={value}
          placeholder="태그 추가 (Enter)"
          spellCheck={false}
          aria-label="태그 추가"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(event) => {
            setValue(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            // 한글 조합을 끝내는 Enter는 태그를 만들지 않는다.
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === "ArrowDown" && suggestions.length) {
              event.preventDefault();
              setActive((index) => (index + 1) % suggestions.length);
            } else if (event.key === "ArrowUp" && suggestions.length) {
              event.preventDefault();
              setActive(
                (index) =>
                  (index - 1 + suggestions.length) % suggestions.length,
              );
            } else if (event.key === "Enter") {
              event.preventDefault();
              submit(suggestions[active]?.name ?? value);
            } else if (event.key === "Escape" && value) {
              event.stopPropagation();
              setValue("");
            }
          }}
          className="w-full min-w-0 rounded-lg border border-rule bg-white px-2.5 py-2 text-sm text-bark outline-none placeholder:text-lichen focus:border-moss-deep focus:ring-2 focus:ring-moss/30"
        />
        {suggestions.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label="태그 후보"
            className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-rule bg-white p-1 shadow-card"
          >
            {suggestions.map((tag, index) => (
              <li
                key={tag.id}
                role="option"
                aria-selected={index === active}
                onPointerDown={(event) => {
                  // 입력칸 포커스를 잃기 전에 고른다.
                  event.preventDefault();
                  submit(tag.name);
                }}
                onPointerEnter={() => setActive(index)}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${index === active ? "bg-moss-wash text-bark" : "text-bark-soft"}`}
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: connectionColor(tag.color).value }}
                />
                {tag.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
