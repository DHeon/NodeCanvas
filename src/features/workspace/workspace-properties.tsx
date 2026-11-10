import { useRef, useState } from "react";
import type {
  NodeConnection,
  NodeTransformPatch,
  TextNodeContentPatch,
  WorkspaceNode,
} from "./types";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { nodeDisplayName } from "./workspace-tree";
import TextStyleSection from "./text-style-section";
import { normalizeLinkUrl, parseYouTube } from "./link-embed";

function LinkSection({
  node,
  loading,
  onSetUrl,
}: {
  node: Extract<WorkspaceNode, { type: "link_node" }>;
  loading: boolean;
  onSetUrl: (nodeId: string, url: string) => void;
}) {
  const [draft, setDraft] = useState(node.url);
  const [invalid, setInvalid] = useState(false);
  const kind = !node.url
    ? "주소를 넣으면 노드 안에 보여줘요."
    : parseYouTube(node.url)
      ? "유튜브 영상 · 노드 안에서 바로 재생돼요."
      : node.preview?.embeddable
        ? "웹페이지 · 노드 안에 페이지를 띄웠어요."
        : node.preview
          ? "이 사이트는 다른 페이지 안에 띄우는 걸 막아둬서 미리보기 카드로 보여줘요."
          : "링크를 확인하는 중이에요.";
  function apply() {
    const url = normalizeLinkUrl(draft);
    if (!url) {
      setInvalid(true);
      return;
    }
    setDraft(url);
    if (url !== node.url) onSetUrl(node.id, url);
  }
  return (
    <section className={sectionClass}>
      <h3 className={headingClass}>링크</h3>
      <label className="block space-y-1.5 text-xs text-lichen">
        <span>주소</span>
        <input
          type="url"
          inputMode="url"
          spellCheck={false}
          value={draft}
          placeholder="https://"
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onBlur={() => {
            if (draft.trim() && draft !== node.url) apply();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              apply();
            }
          }}
          className={`${inputClass} aria-invalid:border-red-600`}
        />
      </label>
      {invalid && (
        <p className="text-xs text-red-600">http·https 웹 주소를 넣어주세요.</p>
      )}
      <p className={hintClass}>{kind}</p>
      {node.url && (
        <div className="flex flex-wrap gap-2">
          <a
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-rule bg-white px-3 py-1.5 text-xs text-bark hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep"
          >
            새 탭에서 열기
          </a>
          <button
            type="button"
            disabled={loading}
            onClick={() => onSetUrl(node.id, node.url)}
            className="rounded-lg border border-rule bg-white px-3 py-1.5 text-xs text-bark hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep disabled:opacity-50"
          >
            {loading ? "확인 중…" : "다시 불러오기"}
          </button>
        </div>
      )}
    </section>
  );
}
import type { TextStyle } from "./text-style";
import {
  CONNECTION_COLORS,
  connectionColor,
  type ConnectionColor,
} from "./connection-colors";

function ConnectionColorPicker({
  connection,
  onChange,
}: {
  connection: NodeConnection;
  onChange: (connectionId: string, color: ConnectionColor) => void;
}) {
  const current = connectionColor(connection.color);
  return (
    <fieldset>
      <legend className="mb-2 text-xs text-lichen">색 · {current.label}</legend>
      <div className="flex flex-wrap gap-2">
        {CONNECTION_COLORS.map((color) => (
          <label
            key={color.key}
            title={color.label}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-full has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-moss-deep"
          >
            <input
              type="radio"
              name={`connection-color-${connection.id}`}
              value={color.key}
              checked={current.key === color.key}
              onChange={() => onChange(connection.id, color.key)}
              aria-label={color.label}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={`h-6 w-6 rounded-full ${current.key === color.key ? "ring-2 ring-bark ring-offset-2 ring-offset-paper" : ""}`}
              style={{ backgroundColor: color.value }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const inputClass =
  "w-full min-w-0 rounded-lg border border-rule bg-white px-2.5 py-2 text-sm text-bark tabular-nums outline-none focus:border-moss-deep focus:ring-2 focus:ring-moss/30";
const sectionClass = "space-y-3 border-t border-rule-soft pt-5";
const headingClass = "text-xs font-semibold text-bark-soft";
const hintClass = "text-xs leading-5 break-keep text-lichen";

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
    <label className="flex min-w-0 items-center gap-2 text-xs text-lichen">
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
  onOpenImage: (nodeId: string) => void;
  onRemoveImage: (nodeId: string) => void;
  onTextStyle: (nodeId: string, patch: TextStyle) => void;
  onSetLinkUrl: (nodeId: string, url: string) => void;
  linkLoading: boolean;
  onDelete: () => void;
  canvasNodes: WorkspaceNode[];
  selectedConnection: NodeConnection | undefined;
  onConnectionColor: (connectionId: string, color: ConnectionColor) => void;
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
  onOpenImage,
  onRemoveImage,
  onTextStyle,
  onSetLinkUrl,
  linkLoading,
  onDelete,
  canvasNodes,
  selectedConnection,
  onConnectionColor,
  onReturnToCanvas,
}: PropertiesProps) {
  const connectionEnds = selectedConnection
    ? [selectedConnection.source, selectedConnection.target].map((end) =>
        canvasNodes.find((item) => item.id === end.nodeId),
      )
    : [];
  return (
    <div className="relative z-30 flex shrink-0">
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "속성 패널 닫기" : "속성 패널 열기"}
        aria-expanded={open}
        aria-controls="workspace-properties"
        title={open ? "속성 패널 닫기" : "속성 패널 열기"}
        className="absolute top-4 right-full grid h-10 w-7 place-items-center rounded-l-lg border border-r-0 border-rule bg-white text-lichen shadow-card hover:bg-mist hover:text-bark focus-visible:outline-2 focus-visible:outline-moss-deep"
      >
        {open ? <ChevronRightIcon /> : <ChevronLeftIcon />}
      </button>
      {open && (
        <aside
          id="workspace-properties"
          aria-label="노드 속성"
          className="flex w-72 max-w-[45vw] flex-col border-l border-rule bg-paper"
        >
          <header className="border-b border-rule-soft px-5 py-4">
            <h2 className="text-sm font-medium text-bark">
              {node
                ? node.type === "text_node"
                  ? "텍스트 노드"
                  : node.type === "canvas_node"
                    ? "캔버스 노드"
                    : node.type === "link_node"
                      ? "링크 노드"
                      : "이미지 노드"
                : selectedConnection
                  ? "연결선"
                  : "노드 설정"}
            </h2>
          </header>
          <div className="min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-color:var(--color-rule)_transparent] space-y-6 overflow-y-auto overscroll-contain p-5">
            {!node && selectedConnection ? (
              <>
                <section className="space-y-2">
                  <h3 className={headingClass}>잇는 노드</h3>
                  <p className="text-sm leading-6 break-keep text-bark">
                    {connectionEnds
                      .map((end) => (end ? nodeDisplayName(end) : "없는 노드"))
                      .join(" ↔ ")}
                  </p>
                </section>
                <section className={sectionClass}>
                  <h3 className={headingClass}>선 색</h3>
                  <ConnectionColorPicker
                    connection={selectedConnection}
                    onChange={onConnectionColor}
                  />
                  <p className={hintClass}>
                    선 모양(곡선·각진 선)은 메뉴의 보기에서 캔버스마다 정해요.
                  </p>
                </section>
              </>
            ) : !node ? (
              <p className="text-sm leading-6 break-keep text-lichen">
                {selectionCount > 1
                  ? `노드 ${selectionCount}개를 선택했어요. 방향키로 함께 옮기거나 Ctrl+D로 복제할 수 있어요. 제목·크기를 바꾸려면 하나만 선택하세요.`
                  : "노드를 선택하면 제목·위치·연결을 여기서 바꿀 수 있어요."}
              </p>
            ) : (
              <>
                <section className="space-y-3">
                  <h3 className={headingClass}>기본 정보</h3>
                  <label className="block space-y-2 text-xs text-lichen">
                    <span>제목</span>
                    <input
                      aria-label="노드 제목"
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
                <section className={sectionClass}>
                  <h3 className={headingClass}>위치 · 크기</h3>
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
                  <p className={hintClass}>
                    Enter로 적용, Esc로 취소.{" "}
                    {infinite
                      ? "무한 캔버스는 음수 좌표도 쓸 수 있어요."
                      : "캔버스 범위 안으로 맞춰져요."}
                  </p>
                </section>
                {node.type === "text_node" ? (
                  <>
                    <TextStyleSection
                      nodeId={node.id}
                      style={node.textStyle}
                      onChange={onTextStyle}
                      sectionClass={sectionClass}
                      headingClass={headingClass}
                    />
                    <section className={sectionClass}>
                      <h3 className={headingClass}>본문</h3>
                      <textarea
                        aria-label="텍스트 본문"
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
                  </>
                ) : node.type === "link_node" ? (
                  <LinkSection
                    key={`${node.id}:${node.url}`}
                    node={node}
                    loading={linkLoading}
                    onSetUrl={onSetLinkUrl}
                  />
                ) : node.type === "image_node" ? (
                  <section className={sectionClass}>
                    <h3 className={headingClass}>이미지</h3>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => onChooseImage(node.id)}
                      className={`${inputClass} text-left hover:bg-mist disabled:opacity-50`}
                    >
                      {uploading
                        ? "업로드 중…"
                        : node.image
                          ? "이미지 교체"
                          : "이미지 선택"}
                    </button>
                    {node.image && (
                      <>
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => onOpenImage(node.id)}
                          className={`${inputClass} text-left hover:bg-mist disabled:opacity-50`}
                        >
                          크게 보기
                        </button>
                        <p className="text-xs leading-5 text-lichen tabular-nums">
                          {node.image.width} × {node.image.height}px ·{" "}
                          {Math.ceil(node.image.byteLength / 1024)}KB
                        </p>
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => onRemoveImage(node.id)}
                          className="rounded-sm text-xs text-lichen underline underline-offset-4 hover:text-bark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep disabled:opacity-50"
                        >
                          이미지 제거
                        </button>
                      </>
                    )}
                    <p className={hintClass}>
                      PNG·JPEG·WebP·GIF, 최대 10MB. Ctrl+V로 붙여넣을 수도
                      있어요.
                    </p>
                  </section>
                ) : (
                  <p className="border-t border-rule-soft pt-5 text-xs leading-5 break-keep text-lichen">
                    노드의 열기 버튼으로 하위 작업 공간에 들어가요. Alt+↑로 다시
                    올라올 수 있어요.
                  </p>
                )}
              </>
            )}
          </div>
          <footer className="shrink-0 border-t border-rule-soft p-4">
            <button
              type="button"
              disabled={selectionCount === 0 && !selectedConnection}
              onClick={onDelete}
              className="w-full rounded-lg border border-red-200 bg-red-50 py-2 text-sm text-red-600 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-40"
            >
              {selectionCount > 1
                ? `노드 ${selectionCount}개 삭제`
                : !node && selectedConnection
                  ? "연결선 삭제"
                  : "노드 삭제"}
            </button>
          </footer>
        </aside>
      )}
    </div>
  );
}
