"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "./icons";
import type { ImageNode, ImageReference } from "./types";

type ImageViewerProps = {
  projectId: string;
  node: ImageNode & { image: ImageReference };
  onClose: () => void;
};

const toolButton =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70";

/**
 * 이미지 노드를 화면 가득 보는 보기 창. 네이티브 dialog의 모달 모드로 열어
 * 포커스 가두기·Esc 닫기·배경 비활성화를 브라우저에 맡긴다.
 */
export default function ImageViewer({
  projectId,
  node,
  onClose,
}: ImageViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [actualSize, setActualSize] = useState(false);
  const { image } = node;
  const title = node.title.trim() || "이미지";

  const previousFocusRef = useRef<Element | null>(null);

  // 정리 함수에서 close()를 부르지 않는다. 개발 모드의 effect 재실행(마운트→정리→마운트)에서
  // close 이벤트가 나가 바로 닫혀 버리기 때문이다. 화면에서 빠지면 dialog도 함께 사라진다.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    previousFocusRef.current = document.activeElement;
    dialog.showModal();
    dialog
      .querySelector<HTMLElement>("[data-autofocus]")
      ?.focus({ preventScroll: true });
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label={`${title} 크게 보기`}
      onClose={() => {
        const previous = previousFocusRef.current;
        if (previous instanceof HTMLElement)
          previous.focus({ preventScroll: true });
        onClose();
      }}
      // 편집기의 단축키(Delete·Ctrl+Z·붙여넣기)가 보기 창 뒤 문서를 바꾸지 않게 막는다.
      onKeyDown={(event) => event.stopPropagation()}
      onPaste={(event) => event.stopPropagation()}
      className="m-0 h-dvh max-h-none w-dvw max-w-none bg-transparent p-0 text-white opacity-100 transition-opacity duration-150 ease-out backdrop:bg-bark/85 backdrop:backdrop-blur-sm motion-reduce:transition-none starting:opacity-0"
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-medium" title={title}>
              {title}
            </h2>
            <p className="text-xs text-white/60 tabular-nums">
              {image.width} × {image.height}px ·{" "}
              {Math.ceil(image.byteLength / 1024)}KB
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActualSize((value) => !value)}
            aria-pressed={actualSize}
            className={toolButton}
          >
            {actualSize ? "화면에 맞추기" : "원본 크기"}
          </button>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="닫기 (Esc)"
            title="닫기 (Esc)"
            // React의 autoFocus는 DOM 속성이 아니어서 dialog가 첫 버튼에 포커스를 준다.
            // 닫기를 먼저 받도록 data-autofocus로 표시하고 열 때 직접 옮긴다.
            data-autofocus=""
            className={`${toolButton} w-9 px-0`}
          >
            <CloseIcon size={18} />
          </button>
        </header>
        {/* 그림 바깥(어두운 여백)을 누르면 닫힌다. */}
        <div
          className={`min-h-0 flex-1 overflow-auto overscroll-contain px-4 pb-6 sm:px-6 ${actualSize ? "" : "flex items-center justify-center"}`}
          onClick={(event) => {
            if (event.target === event.currentTarget)
              dialogRef.current?.close();
          }}
        >
          <Image
            src={`/api/projects/${projectId}/images/${image.id}`}
            alt={title}
            width={image.width}
            height={image.height}
            unoptimized
            draggable={false}
            onDoubleClick={() => setActualSize((value) => !value)}
            className={
              actualSize
                ? "mx-auto block h-auto w-auto max-w-none cursor-zoom-out"
                : "max-h-full w-auto max-w-full cursor-zoom-in rounded-lg object-contain shadow-float"
            }
          />
        </div>
      </div>
    </dialog>
  );
}
