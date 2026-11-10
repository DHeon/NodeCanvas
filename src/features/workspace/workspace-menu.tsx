import { useEffect, useRef, useState, type SubmitEvent } from "react";
import type { WorkspaceDocument } from "./types";

export default function WorkspaceMenu({
  canvas,
  onApply,
  onExport,
  onViewChange,
}: {
  canvas: WorkspaceDocument["canvas"];
  onApply: (canvas: WorkspaceDocument["canvas"]) => string | null;
  onExport: () => void;
  onViewChange: (
    patch: Pick<WorkspaceDocument["canvas"], "lineStyle" | "grid">,
  ) => void;
}) {
  const [menu, setMenu] = useState<"file" | "edit" | "view" | null>(null);
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

  function toggle(next: "file" | "edit" | "view", button: HTMLButtonElement) {
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
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      onExport();
                      setMenu(null);
                      trigger.current?.focus();
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-bark hover:bg-mist focus-visible:outline-2 focus-visible:outline-moss-deep"
                  >
                    JSON으로 내려받기
                  </button>
                  <p className="px-3 text-xs leading-5 break-keep text-lichen">
                    하위 작업 공간까지 포함한 프로젝트 전체를 파일로 백업해요.
                    이미지는 서버에 그대로 남아요.
                  </p>
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
