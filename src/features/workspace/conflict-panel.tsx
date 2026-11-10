"use client";

import { primaryButton, quietButton } from "@/features/shell/styles";

type ConflictPanelProps = {
  busy: boolean;
  onDownload: () => void;
  onLoadServer: () => void;
  onOverwrite: () => void;
};

/** 다른 탭·기기에서 먼저 저장했을 때(409) 고를 수 있는 복구 경로. */
export default function ConflictPanel({
  busy,
  onDownload,
  onLoadServer,
  onOverwrite,
}: ConflictPanelProps) {
  return (
    <section
      role="alert"
      aria-labelledby="conflict-title"
      className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-b border-caution-rule bg-caution-wash px-4 py-3"
    >
      <div className="min-w-0 flex-1 basis-80">
        <h2 id="conflict-title" className="text-sm font-medium text-bark">
          다른 화면에서 이 프로젝트를 먼저 저장했어요
        </h2>
        <p className="mt-0.5 text-xs leading-5 break-keep text-bark-soft">
          지금 화면의 편집 내용은 그대로 남아 있어요. 내려받아 두거나, 서버
          버전을 불러오거나, 지금 내용으로 덮어쓸 수 있어요.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDownload}
          className={`${quietButton} min-h-9 px-3`}
        >
          내 편집 내려받기
        </button>
        <button
          type="button"
          onClick={onLoadServer}
          disabled={busy}
          className={`${quietButton} min-h-9 px-3`}
        >
          서버 버전 불러오기
        </button>
        <button
          type="button"
          onClick={onOverwrite}
          disabled={busy}
          aria-busy={busy}
          className={`${primaryButton} min-h-9 px-3`}
        >
          {busy ? "덮어쓰는 중…" : "내 편집으로 덮어쓰기"}
        </button>
      </div>
    </section>
  );
}
