"use client";

type WorkspaceToolbarProps = {
  onAddTextNode: () => void;
  onAddImageNode: () => void;
  onAddCanvasNode: () => void;
  canvasDepthLimit: boolean;
};

export default function WorkspaceToolbar({
  onAddTextNode,
  onAddImageNode,
  onAddCanvasNode,
  canvasDepthLimit,
}: WorkspaceToolbarProps) {
  return (
    <aside className="absolute top-1/2 left-[18px] z-35 flex -translate-y-1/2 flex-col rounded-2xl border border-neutral-950/10 bg-white/95 p-[7px] shadow-[0_16px_45px_rgba(35,38,39,0.12)] backdrop-blur-[18px]">
      <div
        role="group"
        aria-label="노드 추가 도구"
        className="flex flex-col gap-[5px]"
      >
        <button
          type="button"
          onClick={onAddTextNode}
          aria-label="텍스트 노드 추가"
          title="텍스트 노드 추가"
          className="flex h-10 w-10 items-center justify-center rounded-[11px] text-neutral-700 hover:bg-neutral-950/6 focus-visible:outline-2 focus-visible:outline-violet-500 active:bg-neutral-950/10"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 5h12M9 5v14M5 19h8M19 10v8M15 14h8" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onAddImageNode}
          aria-label="이미지 노드 추가"
          title="이미지 노드 추가"
          className="flex h-10 w-10 items-center justify-center rounded-[11px] text-neutral-700 hover:bg-neutral-950/6 focus-visible:outline-2 focus-visible:outline-violet-500 active:bg-neutral-950/10"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8" cy="8" r="1.5" />
            <path d="m3 17 5-5 4 4 4-6 5 7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onAddCanvasNode}
          aria-label="캔버스 노드 추가"
          disabled={canvasDepthLimit}
          title={
            canvasDepthLimit
              ? "하위 작업 공간의 깊이 제한에 도달했습니다."
              : "캔버스 노드 추가"
          }
          className="flex h-10 w-10 items-center justify-center rounded-[11px] text-neutral-700 hover:bg-neutral-950/6 focus-visible:outline-2 focus-visible:outline-violet-500 active:bg-neutral-950/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <path d="M10 15l5-5m-4 0h4v4" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
