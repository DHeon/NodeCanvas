import Image from "next/image";
import { ExpandIcon, PlusIcon } from "./icons";
import NodeFrame, { type NodeFrameProps } from "./node-frame";
import type { ImageNode } from "./types";

type ImageNodeViewProps = Omit<NodeFrameProps, "node" | "children"> & {
  node: ImageNode;
  projectId: string;
  uploading: boolean;
  error: string;
  onChooseImage: (nodeId: string) => void;
  onOpenImage: (nodeId: string) => void;
};

export default function ImageNodeView({
  node,
  projectId,
  uploading,
  error,
  onChooseImage,
  onOpenImage,
  ...frame
}: ImageNodeViewProps) {
  return (
    <NodeFrame {...frame} node={node}>
      <div
        className={`relative flex min-h-0 flex-1 items-center justify-center bg-paper p-2 select-none ${node.image ? "cursor-zoom-in" : ""}`}
        title={node.image ? "더블클릭해서 크게 보기" : undefined}
        onDoubleClick={(event) => {
          if (!node.image || uploading) return;
          event.stopPropagation();
          // 더블클릭이 남긴 글자 선택을 지워 보기 창에 선택 표시가 번지지 않게 한다.
          window.getSelection()?.removeAllRanges();
          onOpenImage(node.id);
        }}
      >
        {node.image && !uploading && (
          <button
            type="button"
            onClick={() => onOpenImage(node.id)}
            aria-label={`${node.title.trim() || "이미지"} 크게 보기`}
            title="크게 보기"
            className="absolute top-2 right-2 z-10 hidden h-7 w-7 place-items-center rounded-md bg-white/90 text-bark-soft shadow-card group-focus-within/node:grid group-hover/node:grid hover:bg-white hover:text-bark focus-visible:grid focus-visible:outline-2 focus-visible:outline-moss-deep"
          >
            <ExpandIcon size={14} />
          </button>
        )}
        {node.image ? (
          <Image
            key={node.image.id}
            src={`/api/projects/${projectId}/images/${node.image.id}`}
            alt={node.title || "이미지"}
            width={node.image.width}
            height={node.image.height}
            unoptimized
            draggable={false}
            className="pointer-events-none h-full min-h-0 w-full object-contain select-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => onChooseImage(node.id)}
            disabled={uploading}
            aria-label="이미지 선택"
            title="이미지 선택 · Ctrl+V로 붙여넣기 가능"
            className="grid h-14 w-14 place-items-center rounded-xl border border-dashed border-rule bg-white text-lichen hover:border-moss-deep hover:bg-moss-wash hover:text-moss-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep disabled:opacity-50"
          >
            <PlusIcon size={22} />
          </button>
        )}
        {uploading && (
          <div
            role="status"
            className="absolute inset-0 grid place-items-center bg-paper/85 text-sm text-bark-soft"
          >
            이미지 업로드 중…
          </div>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="shrink-0 bg-red-50 px-3 py-2 text-xs text-red-600"
        >
          {error}
        </p>
      )}
    </NodeFrame>
  );
}
