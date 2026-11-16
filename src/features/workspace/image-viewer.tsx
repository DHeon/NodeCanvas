"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "./icons";
import { actualSizeButton } from "./image-viewer-scale";
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
  // 화면에 맞춰 볼 때의 배율(그려진 폭 ÷ 원본 폭). 1이면 이미 원본 크기다.
  const [fitScale, setFitScale] = useState<number | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const { image } = node;
  const title = node.title.trim() || "이미지";
  const sizeButton = actualSizeButton(fitScale, actualSize);
  const toggleActualSize = () => {
    if (!sizeButton.disabled) setActualSize((value) => !value);
  };

  // 화면 크기가 바뀌면 맞춤 배율도 바뀌므로 그려진 크기를 계속 잰다.
  useEffect(() => {
    const element = imageRef.current;
    if (!element || actualSize) return;
    const measure = () => {
      if (element.clientWidth > 0)
        setFitScale(element.clientWidth / image.width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [actualSize, image.width]);

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
            onClick={toggleActualSize}
            aria-pressed={actualSize}
            // 눌러도 이유를 볼 수 있도록 disabled 대신 aria-disabled를 쓴다.
            aria-disabled={sizeButton.disabled || undefined}
            title={sizeButton.title}
            className={`${toolButton} tabular-nums aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent`}
          >
            {sizeButton.label}
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
        {/* 자동 여백(m-auto)으로 가운데에 둔다. 화면보다 크면 여백이 0이 되어 위·왼쪽부터 스크롤된다. */}
        <div
          className="flex min-h-0 flex-1 overflow-auto overscroll-contain px-4 pb-6 sm:px-6"
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
            ref={imageRef}
            onLoad={() => {
              const element = imageRef.current;
              if (element && !actualSize && element.clientWidth > 0)
                setFitScale(element.clientWidth / image.width);
            }}
            onDoubleClick={toggleActualSize}
            className={
              actualSize
                ? "m-auto block h-auto w-auto max-w-none shrink-0 cursor-zoom-out"
                : `m-auto max-h-full w-auto max-w-full rounded-lg object-contain shadow-float ${sizeButton.disabled ? "" : "cursor-zoom-in"}`
            }
          />
        </div>
      </div>
    </dialog>
  );
}
