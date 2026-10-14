"use client";

type WorkspaceToolbarProps = {
  onAddTextNode: () => void;
};

export default function WorkspaceToolbar({
  onAddTextNode,
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
      </div>
    </aside>
  );
}
