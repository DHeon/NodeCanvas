import { useEffect, useRef, useState, type SubmitEvent } from "react";
import {
  CONNECTION_COLORS,
  connectionColor,
  type ConnectionColor,
} from "./connection-colors";
import type { TagDefinition, WorkspaceDocument } from "./types";
import ImportProjectButton from "@/features/projects/import-project-button";

type MenuId = "file" | "edit" | "view" | "tags";

export default function WorkspaceMenu({
  canvas,
  onApply,
  onExport,
  onViewChange,
  tags,
  tagUsage,
  onTagRename,
  onTagRecolor,
  onTagDelete,
}: {
  canvas: WorkspaceDocument["canvas"];
  onApply: (canvas: WorkspaceDocument["canvas"]) => string | null;
  /** .nono 파일로 내보낸다. 끝나면(실패 포함) 돌아온다. */
  onExport: () => void | Promise<void>;
  onViewChange: (
    patch: Pick<WorkspaceDocument["canvas"], "lineStyle" | "grid">,
  ) => void;
  tags: TagDefinition[];
  tagUsage: Map<string, number>;
  /** 오류 문구를 돌려주거나, 바꿨으면 null. */
  onTagRename: (tagId: string, name: string) => string | null;
  onTagRecolor: (tagId: string, color: ConnectionColor) => void;
  onTagDelete: (tagId: string) => void;
}) {
  const [menu, setMenu] = useState<MenuId | null>(null);
  const [width, setWidth] = useState(String(canvas.width));
  const [height, setHeight] = useState(String(canvas.height));
  const [infinite, setInfinite] = useState(!!canvas.infinite);
  const [error, setError] = useState("");
  const container = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!menu) return;
    function dismiss(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      )
        setMenu(null);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [menu]);

  function toggle(next: MenuId, button: HTMLButtonElement) {
    trigger.current = button;
    if (next === "edit") {
      setWidth(String(canvas.width));
      setHeight(String(canvas.height));
      setInfinite(!!canvas.infinite);
      setError("");
    }
    setMenu((current) => (current === next ? null : next));
  }
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = onApply({
      width: infinite ? canvas.width : Number(width),
      height: infinite ? canvas.height : Number(height),
      infinite,
    });
    if (message) {
      setError(message);
      return;
    }
    setMenu(null);
    trigger.current?.focus();
  }
  const fieldClass =
    "mt-1 w-full rounded-lg border border-rule bg-white px-3 py-2 text-sm text-bark tabular-nums outline-none focus:border-moss-deep focus:ring-2 focus:ring-moss/30 disabled:bg-mist disabled:text-lichen";
  return (
    <nav
      ref={container}
      aria-label="작업 공간 메뉴"
      className="relative z-40 flex shrink-0 gap-1 border-b border-rule-soft bg-white px-4 py-1 text-sm"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu) {
          event.preventDefault();
          event.stopPropagation();
          setMenu(null);
          trigger.current?.focus();
        }
      }}
    >
      {(
        [
          ["file", "파일"],
          ["edit", "편집"],
          ["view", "보기"],
          ["tags", "태그"],
        ] as const
      ).map(([id, label]) => (
        <div key={id} className="relative">
          <button
            type="button"
            aria-expanded={menu === id}
            aria-controls={`workspace-menu-${id}`}
            onClick={(event) => toggle(id, event.currentTarget)}
            className={`rounded-md px-3 py-1.5 text-bark-soft hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep ${menu === id ? "bg-mist text-bark" : ""}`}
          >
            {label}
          </button>
          {menu === id && (
            <section
              id={`workspace-menu-${id}`}
              aria-label={`${label} 메뉴`}
              className="absolute top-full left-0 mt-1 min-h-12 w-72 rounded-xl border border-rule bg-white p-4 shadow-float"
            >
              {id === "file" && (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      void onExport();
                      setMenu(null);
                      trigger.current?.focus();
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-bark hover:bg-mist focus-visible:outline-2 focus-visible:outline-moss-deep"
                  >
                    내보내기
                  </button>
                  <ImportProjectButton
                    variant="menu"
                    onDone={() => setMenu(null)}
                  />
                </div>
              )}
              {id === "view" && (
                <div className="space-y-4">
                  <h2 className="font-medium text-bark">이 캔버스 보기</h2>
                  <fieldset>
                    <legend className="mb-1.5 text-xs text-lichen">
                      연결선 모양
                    </legend>
                    <div className="grid grid-cols-2 rounded-lg border border-rule p-0.5">
                      {(
                        [
                          ["curved", "곡선"],
                          ["orthogonal", "각진 선"],
                        ] as const
                      ).map(([value, label]) => {
                        const active = (canvas.lineStyle ?? "curved") === value;
                        return (
                          <label
                            key={value}
                            className={`flex cursor-pointer items-center justify-center rounded-md px-3 py-1.5 text-sm has-focus-visible:outline-2 has-focus-visible:outline-moss-deep ${active ? "bg-ink text-white" : "text-bark-soft hover:bg-mist"}`}
                          >
                            <input
                              type="radio"
                              name="line-style"
                              value={value}
                              checked={active}
                              onChange={() =>
                                onViewChange({ lineStyle: value })
                              }
                              className="sr-only"
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  <label className="flex items-center gap-2 text-bark-soft">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-moss-deep"
                      checked={canvas.grid !== false}
                      onChange={(event) =>
                        onViewChange({ grid: event.target.checked })
                      }
                    />
                    점 배경 표시
                  </label>
                  <p className="text-xs leading-5 break-keep text-lichen">
                    지금 열린 캔버스에만 적용돼요. 하위 캔버스는 각자 따로 정할
                    수 있어요.
                  </p>
                </div>
              )}
              {id === "tags" && (
                <div className="space-y-3">
                  <h2 className="font-medium text-bark">
                    태그{" "}
                    <span className="text-xs font-normal text-lichen tabular-nums">
                      {tags.length}개
                    </span>
                  </h2>
                  {tags.length === 0 ? (
                    <p className="text-xs leading-5 break-keep text-lichen">
                      아직 태그가 없어요. 노드 속성에서 태그를 붙여보세요.
                    </p>
                  ) : (
                    <ul className="-mx-1 max-h-72 space-y-1 overflow-y-auto px-1">
                      {tags.map((tag) => (
                        <TagRow
                          key={tag.id}
                          tag={tag}
                          count={tagUsage.get(tag.id) ?? 0}
                          onRename={(name) => onTagRename(tag.id, name)}
                          onRecolor={(color) => onTagRecolor(tag.id, color)}
                          onDelete={() => {
                            const count = tagUsage.get(tag.id) ?? 0;
                            if (
                              count > 0 &&
                              !window.confirm(
                                `"${tag.name}" 태그를 지울까요? 이 태그를 단 노드 ${count}개에서 모두 떨어집니다. 실행 취소로 되돌릴 수 있습니다.`,
                              )
                            )
                              return;
                            onTagDelete(tag.id);
                          }}
                        />
                      ))}
                    </ul>
                  )}
                  <p className="text-xs leading-5 break-keep text-lichen">
                    이름과 색은 이 프로젝트의 모든 캔버스에 함께 바뀌어요.
                  </p>
                </div>
              )}
              {id === "edit" && (
                <form onSubmit={submit} className="space-y-4">
                  <h2 className="font-medium text-bark">캔버스 크기</h2>
                  <label className="flex items-center gap-2 text-bark-soft">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-moss-deep"
                      checked={infinite}
                      onChange={(event) => {
                        setInfinite(event.target.checked);
                        setError("");
                      }}
                    />
                    무한 캔버스
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs text-lichen">
                      가로
                      <input
                        aria-label="캔버스 가로"
                        type="number"
                        min={320}
                        max={10000}
                        step={1}
                        required
                        disabled={infinite}
                        value={width}
                        onChange={(event) => setWidth(event.target.value)}
                        className={fieldClass}
                      />
                    </label>
                    <label className="text-xs text-lichen">
                      세로
                      <input
                        aria-label="캔버스 세로"
                        type="number"
                        min={240}
                        max={10000}
                        step={1}
                        required
                        disabled={infinite}
                        value={height}
                        onChange={(event) => setHeight(event.target.value)}
                        className={fieldClass}
                      />
                    </label>
                  </div>
                  <p className="text-xs leading-5 break-keep text-lichen">
                    {infinite
                      ? "경계 없이 이동·배치할 수 있습니다. 화면 맞춤은 노드 전체를 기준으로 합니다."
                      : "단위: px. 영역을 벗어난 배치는 간격을 유지하며 안으로 이동합니다."}
                    <br />
                    바꾼 설정은 자동으로 저장돼요.
                  </p>
                  {error && (
                    <p role="alert" className="text-xs leading-5 text-red-600">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-ink py-2 font-medium text-white hover:bg-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep"
                  >
                    적용
                  </button>
                </form>
              )}
            </section>
          )}
        </div>
      ))}
    </nav>
  );
}

/** 태그 관리 목록의 한 줄: 색 원(팔레트) · 이름 입력 · 사용 수 · 지우기. */
function TagRow({
  tag,
  count,
  onRename,
  onRecolor,
  onDelete,
}: {
  tag: TagDefinition;
  count: number;
  onRename: (name: string) => string | null;
  onRecolor: (color: ConnectionColor) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(tag.name);
  const [error, setError] = useState("");
  const [palette, setPalette] = useState(false);
  const [syncedName, setSyncedName] = useState(tag.name);
  // 실행 취소 등으로 이름이 바뀌면 입력칸도 따라간다.
  if (syncedName !== tag.name) {
    setSyncedName(tag.name);
    setDraft(tag.name);
    setError("");
  }

  function commit() {
    if (draft === tag.name) {
      setError("");
      return;
    }
    const message = onRename(draft);
    setError(message ?? "");
    // 바뀐 이름은 위 동기화가 채운다. 정규화만 된 입력("#기획")은 원래 이름으로 돌린다.
    if (!message) setDraft(tag.name);
  }

  return (
    <li className="rounded-lg px-1 py-1 hover:bg-mist/60">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`${tag.name} 태그 색 바꾸기`}
          aria-expanded={palette}
          onClick={() => setPalette((open) => !open)}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-mist-deep focus-visible:outline-2 focus-visible:outline-moss-deep"
        >
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 rounded-full"
            style={{ backgroundColor: connectionColor(tag.color).value }}
          />
        </button>
        <input
          type="text"
          value={draft}
          aria-label={`${tag.name} 태그 이름`}
          aria-invalid={!!error}
          spellCheck={false}
          onChange={(event) => {
            setDraft(event.target.value);
            setError("");
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape" && draft !== tag.name) {
              event.stopPropagation();
              setDraft(tag.name);
              setError("");
            }
          }}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-bark outline-none hover:border-rule focus:border-moss-deep focus:bg-white focus:ring-2 focus:ring-moss/30 aria-invalid:border-red-400"
        />
        <span className="shrink-0 text-xs text-lichen tabular-nums">
          노드 {count}개
        </span>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`${tag.name} 태그 지우기`}
          className="shrink-0 rounded-md px-1.5 py-1 text-xs text-lichen hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-600"
        >
          지우기
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 pl-9 text-xs leading-5 text-red-600">
          {error}
        </p>
      )}
      {palette && (
        <fieldset
          className="mt-1 ml-9 flex flex-wrap gap-1"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setPalette(false);
            }
          }}
        >
          <legend className="sr-only">{tag.name} 태그 색</legend>
          {CONNECTION_COLORS.map((color) => (
            <label
              key={color.key}
              title={color.label}
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-full has-focus-visible:outline-2 has-focus-visible:outline-moss-deep"
            >
              <input
                type="radio"
                name={`menu-tag-color-${tag.id}`}
                checked={tag.color === color.key}
                onChange={() => {
                  onRecolor(color.key);
                  setPalette(false);
                }}
                aria-label={color.label}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`h-5 w-5 rounded-full ${tag.color === color.key ? "ring-2 ring-bark ring-offset-2 ring-offset-white" : ""}`}
                style={{ backgroundColor: color.value }}
              />
            </label>
          ))}
        </fieldset>
      )}
    </li>
  );
}
