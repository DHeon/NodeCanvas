import { useState } from "react";
import { ArrowUpRightIcon, LinkIcon, PlayIcon } from "./icons";
import {
  linkHostLabel,
  normalizeLinkUrl,
  parseYouTube,
  youtubeEmbedUrl,
} from "./link-embed";
import NodeFrame, { type NodeFrameProps } from "./node-frame";
import type { LinkNode } from "./types";

type LinkNodeViewProps = Omit<NodeFrameProps, "node" | "children"> & {
  node: LinkNode;
  loading: boolean;
  error: string;
  onSetUrl: (nodeId: string, url: string) => void;
};

function UrlForm({
  nodeId,
  onSetUrl,
}: {
  nodeId: string;
  onSetUrl: (nodeId: string, url: string) => void;
}) {
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  return (
    <form
      // "youtu.be/…"처럼 https://가 없는 주소도 받으려고 브라우저 기본 URL 검사를 끄고 직접 다듬는다.
      noValidate
      className="flex w-full max-w-sm flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const url = normalizeLinkUrl(value);
        if (!url) {
          setInvalid(true);
          return;
        }
        onSetUrl(nodeId, url);
      }}
    >
      <label
        htmlFor={`link-url-${nodeId}`}
        // 화면에는 숨기고 스크린리더에만 입력칸 이름으로 읽힌다.
        className="sr-only"
      >
        유튜브·웹페이지 주소
      </label>
      <div className="flex gap-2">
        <input
          id={`link-url-${nodeId}`}
          type="url"
          inputMode="url"
          value={value}
          placeholder="https://"
          spellCheck={false}
          aria-invalid={invalid || undefined}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => {
            setValue(event.target.value);
            setInvalid(false);
          }}
          className="min-w-0 flex-1 rounded-lg border border-rule bg-white px-2.5 py-2 text-sm text-bark outline-none placeholder:text-lichen focus:border-moss-deep focus:ring-2 focus:ring-moss/30 aria-invalid:border-red-600"
        />
        <button
          type="submit"
          aria-label="링크 넣기"
          title="링크 넣기 (Enter)"
          className="grid w-10 shrink-0 place-items-center rounded-lg bg-ink text-white hover:bg-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep"
        >
          <PlayIcon size={16} />
        </button>
      </div>
      {invalid && (
        <p className="text-xs text-red-600">http·https 웹 주소를 넣어주세요.</p>
      )}
    </form>
  );
}

export default function LinkNodeView({
  node,
  loading,
  error,
  onSetUrl,
  ...frame
}: LinkNodeViewProps) {
  const video = node.url ? parseYouTube(node.url) : null;
  const preview = node.preview;
  const host = node.url ? linkHostLabel(node.url) : "";
  const label = preview?.title || node.title || host;

  let body;
  if (!node.url) {
    body = (
      <div className="grid min-h-0 flex-1 place-items-center bg-paper p-4">
        <UrlForm nodeId={node.id} onSetUrl={onSetUrl} />
      </div>
    );
  } else if (video) {
    // 유튜브는 노드 본문에 플레이어만 꽉 채운다.
    body = (
      <iframe
        src={youtubeEmbedUrl(video)}
        title={label || "유튜브 영상"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
        className="min-h-0 w-full flex-1 bg-bark"
      />
    );
  } else if (preview?.embeddable) {
    body = (
      <iframe
        src={node.url}
        title={label}
        // 페이지가 편집기 창을 조작하지 못하게 최소한의 권한만 준다.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        loading="lazy"
        className="min-h-0 w-full flex-1 bg-white"
      />
    );
  } else if (!preview && loading) {
    body = (
      <div
        role="status"
        className="grid min-h-0 flex-1 place-items-center bg-paper text-sm text-lichen"
      >
        링크 확인 중…
      </div>
    );
  } else {
    // 사이트가 다른 페이지 안에 들어가는 것을 막아두었거나 열 수 없을 때: 미리보기 카드.
    body = (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        {preview?.image && (
          // 외부 이미지라 next/image 대신 그대로 불러온다(주소를 리퍼러로 넘기지 않음).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.image}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            draggable={false}
            className="pointer-events-none h-2/5 min-h-0 w-full shrink object-cover select-none"
          />
        )}
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden p-4">
          <p className="flex items-center gap-1.5 truncate text-xs text-lichen">
            <LinkIcon size={12} />
            {preview?.siteName || host}
          </p>
          <p className="line-clamp-2 text-sm font-medium break-keep text-bark">
            {preview?.title || node.url}
          </p>
          {preview?.description && (
            <p className="line-clamp-3 text-xs leading-5 break-keep text-bark-soft">
              {preview.description}
            </p>
          )}
          {(error || preview) && !preview?.title && (
            <p className="text-xs text-lichen">
              {error || "이 사이트는 노드 안에 띄울 수 없어요."}
            </p>
          )}
          <a
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            onPointerDown={(event) => event.stopPropagation()}
            className="mt-auto inline-flex w-fit items-center gap-1 rounded-md text-xs font-medium text-bark-soft underline underline-offset-4 hover:text-bark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep"
          >
            새 탭에서 열기
            <ArrowUpRightIcon size={12} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <NodeFrame {...frame} node={node}>
      {body}
    </NodeFrame>
  );
}
