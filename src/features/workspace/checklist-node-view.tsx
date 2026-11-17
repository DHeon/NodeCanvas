"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { ChecklistView } from "./checklist";
import { MAX_CHECKLIST_ITEM_LENGTH } from "./checklist";
import { ArrowUpRightIcon, CloseIcon } from "./icons";
import { focusAfterRemoval } from "./keyboard-targets";
import NodeFrame, { type NodeFrameProps } from "./node-frame";
import type { ChecklistNode } from "./types";
import { nodeDisplayName } from "./workspace-tree";

type ChecklistNodeViewProps = Omit<NodeFrameProps, "node" | "children"> & {
  node: ChecklistNode;
  view: ChecklistView;
  onToggleNode: (nodeId: string, done: boolean) => void;
  /** 추가했으면 true(입력칸을 비운다). */
  onAddItem: (text: string) => boolean;
  onEditItem: (
    itemId: string,
    patch: { text?: string; done?: boolean },
  ) => void;
  onRemoveItem: (itemId: string) => void;
  onMakeTodos: (nodeIds: string[]) => void;
  onFocusNode: (nodeId: string) => void;
};

// 목록 안을 눌러도 노드를 끌거나 범위 선택을 시작하지 않는다.
const keepPointer = (event: ReactPointerEvent) => event.stopPropagation();

function CheckBox({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      data-keyboard-control=""
      aria-checked={checked}
      aria-label={label}
      onPointerDown={keepPointer}
      onClick={onToggle}
      className={`grid h-4 w-4 shrink-0 cursor-pointer place-items-center rounded-[5px] border-[1.5px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep motion-reduce:transition-none ${checked ? "border-moss-deep bg-moss-deep text-white" : "border-sage-hover bg-white text-transparent hover:border-moss-deep"}`}
    >
      <svg
        viewBox="0 0 16 16"
        width="10"
        height="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m3.5 8.5 3 3 6-7" />
      </svg>
    </button>
  );
}

/** 연결된 할 일과 직접 쓴 항목을 모아 진행률을 보여주는 노드. */
export default function ChecklistNodeView({
  node,
  view,
  onToggleNode,
  onAddItem,
  onEditItem,
  onRemoveItem,
  onMakeTodos,
  onFocusNode,
  ...frame
}: ChecklistNodeViewProps) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(
    null,
  );
  const percent = view.total ? Math.round((view.done / view.total) * 100) : 0;
  const allDone = view.total > 0 && view.done === view.total;
  const itemIds = view.entries.flatMap((entry) =>
    entry.kind === "item" ? [entry.item.id] : [],
  );
  const listRef = useRef<HTMLUListElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  // 고치기·지우기로 포커스가 있던 요소가 사라지면 이웃 항목이나 추가 입력칸으로 옮긴다.
  // 그래야 Ctrl+Z 같은 캔버스 단축키가 계속 들어온다.
  const pendingFocusRef = useRef<string | null>(null);
  useEffect(() => {
    const target = pendingFocusRef.current;
    if (target === null) return;
    pendingFocusRef.current = null;
    const element =
      target === "add"
        ? addRef.current
        : listRef.current?.querySelector<HTMLElement>(
            `[data-item-text="${target}"]`,
          );
    (element ?? addRef.current)?.focus({ preventScroll: true });
  });

  /** 키보드로 적용하면 포커스를 그 항목(지워졌으면 이웃)으로 돌린다. 바깥을 눌러 적용하면 그대로 둔다. */
  function commitEdit(fromKeyboard: boolean) {
    if (!editing) return;
    if (fromKeyboard)
      pendingFocusRef.current = editing.text.trim()
        ? editing.id
        : (focusAfterRemoval(itemIds, editing.id) ?? "add");
    onEditItem(editing.id, { text: editing.text });
    setEditing(null);
  }

  function removeItem(itemId: string) {
    pendingFocusRef.current = focusAfterRemoval(itemIds, itemId) ?? "add";
    onRemoveItem(itemId);
  }

  return (
    <NodeFrame {...frame} node={node}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-3 pt-2.5 pb-2">
          {view.total === 0 ? (
            <p className="text-xs leading-5 break-keep text-lichen">
              항목을 추가하거나 할 일 노드를 연결해 보세요.
            </p>
          ) : (
            <>
              <p className="flex items-baseline justify-between text-xs tabular-nums">
                <span
                  className={
                    allDone ? "font-medium text-moss-deep" : "text-bark-soft"
                  }
                >
                  {allDone ? "모두 완료" : `${view.done} / ${view.total} 완료`}
                </span>
                <span className="text-lichen">{percent}%</span>
              </p>
              <div
                role="progressbar"
                aria-label="진행률"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-mist-deep"
              >
                <div
                  className="h-full rounded-full bg-moss-deep transition-[width] duration-300 ease-out motion-reduce:transition-none"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </>
          )}
        </div>

        {view.entries.length > 0 && (
          <ul
            ref={listRef}
            data-scroll-region=""
            aria-label="체크리스트 항목"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5"
          >
            {view.entries.map((entry) => {
              if (entry.kind === "node") {
                const name = nodeDisplayName(entry.node);
                return (
                  <li
                    key={`node:${entry.node.id}`}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-mist/70"
                  >
                    <CheckBox
                      checked={entry.done}
                      label={`${name} 완료`}
                      onToggle={() => onToggleNode(entry.node.id, !entry.done)}
                    />
                    <button
                      type="button"
                      onPointerDown={keepPointer}
                      onClick={() => onFocusNode(entry.node.id)}
                      data-keyboard-control=""
                      title=""
                      aria-label={`${name} 노드로 이동`}
                      className={`flex min-w-0 flex-1 items-center gap-1 rounded text-left text-sm focus-visible:outline-2 focus-visible:outline-moss-deep ${entry.done ? "text-lichen line-through decoration-lichen" : "text-bark"}`}
                    >
                      <span className="min-w-0 truncate">{name}</span>
                      <ArrowUpRightIcon
                        size={12}
                        className="shrink-0 text-lichen"
                      />
                    </button>
                  </li>
                );
              }
              const { item } = entry;
              const isEditing = editing?.id === item.id;
              return (
                <li
                  key={`item:${item.id}`}
                  className="group/row flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-mist/70"
                >
                  <CheckBox
                    checked={item.done}
                    label={`${item.text} 완료`}
                    onToggle={() => onEditItem(item.id, { done: !item.done })}
                  />
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editing.text}
                      maxLength={MAX_CHECKLIST_ITEM_LENGTH}
                      aria-label="항목 글 고치기"
                      onPointerDown={keepPointer}
                      onChange={(event) =>
                        setEditing({ id: item.id, text: event.target.value })
                      }
                      onBlur={() => commitEdit(false)}
                      onKeyDown={(event) => {
                        if (
                          event.nativeEvent.isComposing ||
                          event.keyCode === 229
                        )
                          return;
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitEdit(true);
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          event.stopPropagation();
                          pendingFocusRef.current = item.id;
                          setEditing(null);
                        }
                      }}
                      className="min-w-0 flex-1 rounded border border-moss-deep bg-white px-1 text-sm text-bark outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onPointerDown={keepPointer}
                      onClick={() =>
                        setEditing({ id: item.id, text: item.text })
                      }
                      data-item-text={item.id}
                      data-keyboard-control=""
                      aria-label={`${item.text} 고치기`}
                      className={`min-w-0 flex-1 truncate rounded text-left text-sm focus-visible:outline-2 focus-visible:outline-moss-deep ${item.done ? "text-lichen line-through decoration-lichen" : "text-bark"}`}
                    >
                      {item.text}
                    </button>
                  )}
                  {!isEditing && (
                    <button
                      type="button"
                      onPointerDown={keepPointer}
                      onClick={() => removeItem(item.id)}
                      data-keyboard-control=""
                      aria-label={`${item.text} 지우기`}
                      className="grid h-5 w-5 shrink-0 place-items-center rounded text-lichen opacity-0 group-hover/row:opacity-100 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-red-600"
                    >
                      <CloseIcon size={12} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-auto px-3 pt-1 pb-2.5">
          <input
            ref={addRef}
            value={draft}
            maxLength={MAX_CHECKLIST_ITEM_LENGTH}
            placeholder="+ 항목 추가"
            aria-label="체크리스트 항목 추가"
            onPointerDown={keepPointer}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.keyCode === 229)
                return;
              if (event.key === "Enter") {
                event.preventDefault();
                if (onAddItem(draft)) setDraft("");
              } else if (event.key === "Escape" && draft) {
                event.stopPropagation();
                setDraft("");
              }
            }}
            className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-bark outline-none placeholder:text-lichen hover:border-rule focus:border-moss-deep focus:bg-white focus:ring-2 focus:ring-moss/30"
          />
        </div>

        {view.unassignedNodeIds.length > 0 && (
          <div className="flex items-center justify-between gap-2 border-t border-rule-soft px-3 py-2 text-xs">
            <span className="text-lichen">
              역할이 없는 연결 노드 {view.unassignedNodeIds.length}개
            </span>
            <button
              type="button"
              onPointerDown={keepPointer}
              onClick={() => onMakeTodos(view.unassignedNodeIds)}
              data-keyboard-control=""
              className="shrink-0 rounded font-medium text-moss-deep hover:underline focus-visible:outline-2 focus-visible:outline-moss-deep"
            >
              할 일로 만들기
            </button>
          </div>
        )}
      </div>
    </NodeFrame>
  );
}
