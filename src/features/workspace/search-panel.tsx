"use client";

import { useEffect, useId, type Ref } from "react";
import { connectionColor } from "./connection-colors";
import { CloseIcon, SearchIcon } from "./icons";
import type { SearchResult } from "./search";
import type { TagDefinition } from "./types";
import { nodeDisplayName, nodeTypeLabel } from "./workspace-tree";

type SearchPanelProps = {
  query: string;
  onQueryChange: (query: string) => void;
  results: SearchResult[];
  total: number;
  truncated: boolean;
  /** 디바운스가 끝나 결과가 지금 검색어와 맞는지. */
  settled: boolean;
  tags: TagDefinition[];
  activeIndex: number | null;
  onActiveChange: (index: number | null) => void;
  onPick: (result: SearchResult) => void;
  onClose: () => void;
  inputRef?: Ref<HTMLInputElement>;
};

const MAX_TAG_SUGGESTIONS = 6;
const MAX_RESULT_DOTS = 3;

/** 캔버스 오른쪽 위에 뜨는 노드 검색. 목록을 가리키면 캔버스의 노드가 빛나고, 고르면 그 노드로 간다. */
export default function SearchPanel({
  query,
  onQueryChange,
  results,
  total,
  truncated,
  settled,
  tags,
  activeIndex,
  onActiveChange,
  onPick,
  onClose,
  inputRef,
}: SearchPanelProps) {
  const listId = useId();
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
  const optionId = (index: number) => `${listId}-option-${index}`;

  // 마지막 낱말이 '#'으로 시작하면 그 접두로 시작하는 태그를 권한다.
  const lastWord = /(?:^|\s)(#[^\s#]*)$/.exec(query)?.[1];
  const tagPrefix = lastWord?.slice(1).toLowerCase();
  const tagSuggestions =
    tagPrefix === undefined
      ? []
      : tags
          .filter(
            (tag) =>
              tag.name.toLowerCase().startsWith(tagPrefix) &&
              tag.name.toLowerCase() !== tagPrefix,
          )
          .slice(0, MAX_TAG_SUGGESTIONS);

  // 마지막 '#낱말' 앞부분. 컴파일러가 의존성으로 끌어올려도 안전하도록 함수 밖에서 구한다.
  const queryBeforeTag = query.slice(0, query.length - (lastWord?.length ?? 0));

  function completeTag(tag: TagDefinition) {
    onQueryChange(`${queryBeforeTag}#${tag.name} `);
  }

  useEffect(() => {
    if (activeIndex === null) return;
    document
      .getElementById(`${listId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listId]);

  const hasQuery = query.trim().length > 0;

  return (
    <section
      data-search-panel=""
      aria-label="노드 검색"
      className="absolute top-3 right-10 z-40 flex max-h-[calc(100%-1.5rem)] w-80 max-w-[calc(100%-5rem)] flex-col rounded-xl border border-rule bg-white shadow-float"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b border-rule-soft px-3 py-2">
        <SearchIcon size={16} className="shrink-0 text-lichen" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          autoFocus
          spellCheck={false}
          placeholder="제목·내용 또는 #태그"
          aria-label="노드 검색"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex !== null && results[activeIndex]
              ? optionId(activeIndex)
              : undefined
          }
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === "ArrowDown" && results.length) {
              event.preventDefault();
              onActiveChange(
                activeIndex === null
                  ? 0
                  : Math.min(activeIndex + 1, results.length - 1),
              );
            } else if (event.key === "ArrowUp" && results.length) {
              event.preventDefault();
              onActiveChange(Math.max((activeIndex ?? 0) - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              const result = results[activeIndex ?? 0];
              if (result) onPick(result);
            } else if (event.key === "Tab" && tagSuggestions.length) {
              event.preventDefault();
              completeTag(tagSuggestions[0]);
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }
          }}
          className="min-w-0 flex-1 bg-transparent py-1 text-sm text-bark outline-none placeholder:text-lichen [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="검색 닫기"
          title="검색 닫기 (Esc)"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-lichen hover:bg-mist hover:text-bark focus-visible:outline-2 focus-visible:outline-moss-deep"
        >
          <CloseIcon size={14} />
        </button>
      </div>

      {tagSuggestions.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5 border-b border-rule-soft px-3 py-2"
          aria-label="태그 후보"
          role="group"
        >
          {tagSuggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => completeTag(tag)}
              className="flex items-center gap-1.5 rounded-full border border-rule px-2 py-0.5 text-xs text-bark-soft hover:bg-mist focus-visible:outline-2 focus-visible:outline-moss-deep"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: connectionColor(tag.color).value }}
              />
              {tag.name}
            </button>
          ))}
        </div>
      )}

      <p
        role="status"
        className="px-3 pt-2 pb-1 text-xs leading-5 break-keep text-lichen"
      >
        {!hasQuery
          ? "제목·내용·태그로 찾아요. #으로 시작하면 태그 이름으로만 찾아요."
          : !settled
            ? "찾는 중…"
            : total === 0
              ? "맞는 노드가 없어요."
              : truncated
                ? `결과 ${total}개 중 ${results.length}개만 보여요. 검색어를 더 좁혀보세요.`
                : `결과 ${total}개`}
      </p>

      {results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="검색 결과"
          className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5"
          onPointerLeave={() => onActiveChange(null)}
        >
          {results.map((result, index) => {
            const nodeTags = (result.node.tags ?? []).flatMap((id) => {
              const tag = tagsById.get(id);
              return tag ? [tag] : [];
            });
            const elsewhere = result.anchorId !== result.node.id;
            return (
              <li
                key={`${result.path.join("/")}:${result.node.id}`}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                onPointerEnter={() => onActiveChange(index)}
                onClick={() => onPick(result)}
                className={`cursor-pointer rounded-lg px-2 py-1.5 ${index === activeIndex ? "bg-moss-wash" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-bark">
                    {nodeDisplayName(result.node)}
                  </span>
                  {nodeTags.length > 0 && (
                    <span
                      className="flex shrink-0 items-center gap-1"
                      title={nodeTags.map((tag) => tag.name).join(", ")}
                    >
                      {nodeTags.slice(0, MAX_RESULT_DOTS).map((tag) => (
                        <span
                          key={tag.id}
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: connectionColor(tag.color).value,
                          }}
                        />
                      ))}
                      <span className="sr-only">
                        태그 {nodeTags.map((tag) => tag.name).join(", ")}
                      </span>
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-lichen">
                    {nodeTypeLabel[result.node.type]}
                  </span>
                </span>
                {elsewhere && (
                  <span className="mt-0.5 block truncate text-xs text-lichen">
                    {result.trail.length
                      ? result.trail.join(" › ")
                      : "최상위 공간"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
