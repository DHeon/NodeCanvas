import { useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { nodeDisplayName } from "./workspace-tree";
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
import type {
  NodeConnection,
  NodeTransformPatch,
  TextNodeContentPatch,
  WorkspaceNode,
} from "./types";

const inputClass =
  "w-full min-w-0 rounded-lg border border-rule bg-white px-2.5 py-2 text-sm text-bark tabular-nums outline-none focus:border-moss-deep focus:ring-2 focus:ring-moss/30";
const sectionClass = "space-y-3 border-t border-rule-soft pt-5";
const headingClass = "text-xs font-semibold text-bark-soft";
const hintClass = "text-xs leading-5 break-keep text-lichen";

function ConnectionSection({
  node,
  canvasNodes,
  connections,
  onConnect,
  onDisconnect,
}: {
  node: WorkspaceNode;
  canvasNodes: WorkspaceNode[];
  connections: NodeConnection[];
  onConnect: (sourceId: string, targetId: string) => void;
  onDisconnect: (connectionId: string) => void;
}) {
  const byId = new Map(canvasNodes.map((item) => [item.id, item]));
  const linked = connections.flatMap((connection) => {
    const otherId =
      connection.source.nodeId === node.id
        ? connection.target.nodeId
        : connection.target.nodeId === node.id
          ? connection.source.nodeId
          : null;
    const other = otherId ? byId.get(otherId) : undefined;
    return other ? [{ connection, other }] : [];
  });
  const linkedIds = new Set(linked.map(({ other }) => other.id));
  const candidates = canvasNodes.filter(
    (item) => item.id !== node.id && !linkedIds.has(item.id),
  );
  return (
    <section className={sectionClass}>
      <h3 className={headingClass}>연결</h3>
      {linked.length > 0 ? (
        <ul className="space-y-1.5">
          {linked.map(({ connection, other }) => (
            <li
              key={connection.id}
              className="flex items-center gap-2 rounded-lg border border-rule-soft bg-white px-2.5 py-1.5 text-sm"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: connectionColor(connection.color).value,
                }}
              />
              <span
                className="min-w-0 flex-1 truncate"
                title={nodeDisplayName(other)}
              >
                {nodeDisplayName(other)}
              </span>
              <button
                type="button"
                onClick={() => onDisconnect(connection.id)}
                aria-label={`${nodeDisplayName(other)}와의 연결 끊기`}
                title="연결 끊기"
                className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-lichen hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-red-600"
              >
                끊기
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={hintClass}>아직 연결된 노드가 없어요.</p>
      )}
      {candidates.length > 0 && (
        <label className="block space-y-1.5 text-xs text-lichen">
          <span>다른 노드와 연결</span>
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) onConnect(node.id, event.target.value);
            }}
            className={`${inputClass} cursor-pointer`}
          >
            <option value="">노드 선택…</option>
            {candidates.map((item) => (
              <option key={item.id} value={item.id}>
                {nodeDisplayName(item)}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}

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
  onRemoveImage: (nodeId: string) => void;
  onDelete: () => void;
  canvasNodes: WorkspaceNode[];
  connections: NodeConnection[];
  onConnect: (sourceId: string, targetId: string) => void;
  onDisconnect: (connectionId: string) => void;
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
  onRemoveImage,
  onDelete,
  canvasNodes,
  connections,
  onConnect,
  onDisconnect,
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
                <ConnectionSection
                  node={node}
                  canvasNodes={canvasNodes}
                  connections={connections}
                  onConnect={onConnect}
                  onDisconnect={onDisconnect}
                />
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
