import { useRef, useState } from "react";
import type {
  NodeTransformPatch,
  TextNodeContentPatch,
  WorkspaceNode,
} from "./types";

const inputClass =
  "w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100";

function NumberField({
  label,
  value,
  onCommit,
  onEditStart,
  onEditEnd,
  onReturnToCanvas,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  onReturnToCanvas: () => void;
}) {
  const [draft, setDraft] = useState(String(Math.round(value * 100) / 100));
  const cancelled = useRef(false);
  const dirty = useRef(false);
  return (
    <label className="flex min-w-0 items-center gap-2 text-xs text-neutral-500">
      <span className="w-4 shrink-0">{label}</span>
      <input
        aria-label={`노드 ${label}`}
        type="number"
        step="1"
        value={draft}
        className={inputClass}
        onFocus={() => {
          cancelled.current = false;
          dirty.current = false;
          onEditStart();
        }}
        onChange={(event) => {
          dirty.current = true;
          setDraft(event.target.value);
        }}
        onBlur={() => {
          const next = Number(draft);
          if (
            dirty.current &&
            !cancelled.current &&
            draft.trim() &&
            Number.isFinite(next)
          )
            onCommit(next);
          setDraft(String(Math.round(value * 100) / 100));
          onEditEnd();
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            cancelled.current = event.key === "Escape";
            event.currentTarget.blur();
            onReturnToCanvas();
          }
        }}
      />
    </label>
  );
}

type PropertiesProps = {
  infinite: boolean;
  open: boolean;
  node: WorkspaceNode | undefined;
  selectionCount: number;
  uploading: boolean;
  onToggle: () => void;
  onChange: (nodeId: string, patch: TextNodeContentPatch) => void;
  onTransform: (nodeId: string, patch: NodeTransformPatch) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  onChooseImage: (nodeId: string) => void;
  onRemoveImage: (nodeId: string) => void;
  onDelete: () => void;
  onReturnToCanvas: () => void;
};

export default function WorkspaceProperties({
  infinite,
  open,
  node,
  selectionCount,
  uploading,
  onToggle,
  onChange,
  onTransform,
  onEditStart,
  onEditEnd,
  onChooseImage,
  onRemoveImage,
  onDelete,
  onReturnToCanvas,
}: PropertiesProps) {
  return (
    <div className="relative z-30 flex shrink-0">
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "Properties 닫기" : "Properties 열기"}
        aria-expanded={open}
        aria-controls="workspace-properties"
        title={open ? "Properties 닫기" : "Properties 열기"}
        className="absolute top-4 right-full grid h-10 w-7 place-items-center rounded-l-lg border border-r-0 border-neutral-300 bg-white text-neutral-600 shadow-sm hover:bg-neutral-100"
      >
        {open ? "›" : "‹"}
      </button>
      {open && (
        <aside
          id="workspace-properties"
          aria-label="노드 Properties"
          className="flex w-72 max-w-[45vw] flex-col border-l border-neutral-300 bg-neutral-50"
        >
          <header className="border-b border-neutral-200 px-5 py-4">
            <p className="text-[10px] font-semibold tracking-widest text-neutral-400">
              PROPERTIES
            </p>
            <h2 className="mt-1 text-sm font-medium">
              {node
                ? node.type === "text_node"
                  ? "텍스트"
                  : "이미지"
                : "노드 설정"}
            </h2>
          </header>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5">
            {!node ? (
              <p className="text-sm leading-6 text-neutral-500">
                {selectionCount > 1
                  ? `${selectionCount}개 선택됨. 설정을 수정하려면 노드 하나를 선택하세요.`
                  : "노드를 선택하면 설정이 표시됩니다."}
              </p>
            ) : (
              <>
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold text-neutral-500">
                    기본 정보
                  </h3>
                  <label className="block space-y-2 text-xs text-neutral-500">
                    <span>제목</span>
                    <input
                      aria-label="Properties 노드 제목"
                      spellCheck={false}
                      maxLength={200}
                      value={node.title}
                      className={inputClass}
                      onFocus={onEditStart}
                      onBlur={onEditEnd}
                      onChange={(event) =>
                        onChange(node.id, { title: event.target.value })
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.nativeEvent.isComposing &&
                          event.keyCode !== 229
                        ) {
                          event.preventDefault();
                          event.currentTarget.blur();
                          onReturnToCanvas();
                        }
                      }}
                    />
                  </label>
                </section>
                <section className="space-y-3 border-t border-neutral-200 pt-5">
                  <h3 className="text-xs font-semibold text-neutral-500">
                    위치 · 크기
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        ["X", node.position.x, "x"],
                        ["Y", node.position.y, "y"],
                        ["W", node.width, "width"],
                        ["H", node.height, "height"],
                      ] as const
                    ).map(([label, value, field]) => (
                      <NumberField
                        key={`${node.id}:${field}:${value}`}
                        label={label}
                        value={value}
                        onEditStart={onEditStart}
                        onEditEnd={onEditEnd}
                        onReturnToCanvas={onReturnToCanvas}
                        onCommit={(next) =>
                          onTransform(node.id, { [field]: next })
                        }
                      />
                    ))}
                  </div>
                  <p className="text-[11px] leading-5 text-neutral-400">
                    Enter 또는 바깥 클릭으로 적용 · Esc로 취소
                    <br />
                    {infinite
                      ? "무한 캔버스에서는 음수 좌표도 사용할 수 있습니다."
                      : "캔버스 범위 내에서 조절됩니다."}
                  </p>
                </section>
                {node.type === "text_node" ? (
                  <section className="space-y-3 border-t border-neutral-200 pt-5">
                    <h3 className="text-xs font-semibold text-neutral-500">
                      본문
                    </h3>
                    <textarea
                      aria-label="Properties 텍스트 본문"
                      spellCheck={false}
                      value={node.text}
                      maxLength={50000}
                      rows={7}
                      className={`${inputClass} resize-y`}
                      onFocus={onEditStart}
                      onBlur={onEditEnd}
                      onChange={(event) =>
                        onChange(node.id, { text: event.target.value })
                      }
                    />
                  </section>
                ) : (
                  <section className="space-y-3 border-t border-neutral-200 pt-5">
                    <h3 className="text-xs font-semibold text-neutral-500">
                      이미지
                    </h3>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => onChooseImage(node.id)}
                      className={`${inputClass} hover:bg-neutral-100 disabled:opacity-50`}
                    >
                      {uploading
                        ? "업로드 중…"
                        : node.image
                          ? "이미지 교체"
                          : "이미지 선택"}
                    </button>
                    {node.image && (
                      <>
                        <p className="text-xs leading-5 text-neutral-500">
                          {node.image.width} × {node.image.height}px ·{" "}
                          {Math.ceil(node.image.byteLength / 1024)}KB
                        </p>
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => onRemoveImage(node.id)}
                          className="text-xs text-neutral-500 underline disabled:opacity-50"
                        >
                          이미지 제거
                        </button>
                      </>
                    )}
                    <p className="text-[11px] leading-5 text-neutral-400">
                      PNG · JPEG · WebP · GIF / 최대 10MB
                      <br />
                      GIF는 첫 프레임만 사용합니다.
                      <br />
                      선택 후 Ctrl+V로 붙여넣기 가능
                      <br />
                      이미지 비율을 유지하여 표시·크기 조절합니다.
                    </p>
                  </section>
                )}
              </>
            )}
          </div>
          <footer className="shrink-0 border-t border-neutral-200 p-4">
            <button
              type="button"
              disabled={!node}
              onClick={onDelete}
              className="w-full rounded-lg border border-red-200 bg-red-50 py-2 text-sm text-red-600 hover:bg-red-100 disabled:opacity-40"
            >
              노드 삭제
            </button>
          </footer>
        </aside>
      )}
    </div>
  );
}
