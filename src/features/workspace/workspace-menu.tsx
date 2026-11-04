import { useEffect, useRef, useState, type SubmitEvent } from "react";
import type { WorkspaceDocument } from "./types";

export default function WorkspaceMenu({
  canvas,
  onApply,
}: {
  canvas: WorkspaceDocument["canvas"];
  onApply: (canvas: WorkspaceDocument["canvas"]) => string | null;
}) {
  const [menu, setMenu] = useState<"file" | "edit" | null>(null);
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

  function toggle(next: "file" | "edit", button: HTMLButtonElement) {
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
    "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 disabled:bg-neutral-100 disabled:text-neutral-400";
  return (
    <nav
      ref={container}
      aria-label="작업 공간 메뉴"
      className="relative z-40 flex shrink-0 gap-1 border-b border-neutral-200 bg-white px-4 py-1 text-sm"
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
        ] as const
      ).map(([id, label]) => (
        <div key={id} className="relative">
          <button
            type="button"
            aria-expanded={menu === id}
            aria-controls={`workspace-menu-${id}`}
            onClick={(event) => toggle(id, event.currentTarget)}
            className={`rounded px-3 py-1.5 hover:bg-neutral-100 ${menu === id ? "bg-neutral-100" : ""}`}
          >
            {label}
          </button>
          {menu === id && (
            <section
              id={`workspace-menu-${id}`}
              aria-label={`${label} 메뉴`}
              className="absolute top-full left-0 mt-1 min-h-12 w-72 rounded-xl border border-neutral-200 bg-white p-4 shadow-lg"
            >
              {id === "edit" && (
                <form onSubmit={submit} className="space-y-4">
                  <h2 className="font-medium">캔버스 크기</h2>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={infinite}
                      onChange={(event) => {
                        setInfinite(event.target.checked);
                        setError("");
                      }}
                    />
                    무한 캔버스
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs text-neutral-600">
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
                    <label className="text-xs text-neutral-600">
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
                  <p className="text-xs leading-5 text-neutral-500">
                    {infinite
                      ? "경계 없이 이동·배치할 수 있습니다. 화면 맞춤은 노드 전체를 기준으로 합니다."
                      : "단위: px. 영역을 벗어난 배치는 간격을 유지하며 안으로 이동합니다."}
                    <br />
                    설정 변경 후 저장 버튼으로 저장하세요.
                  </p>
                  {error && (
                    <p role="alert" className="text-xs leading-5 text-red-600">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-neutral-800 py-2 text-white hover:bg-neutral-700"
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
