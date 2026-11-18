"use client";

import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { MAX_GROUP_TITLE_LENGTH, visibleGroups } from "./groups";
import type { WorkspaceDocument } from "./types";

/** 이름 탭 높이(캔버스 단위). 탭은 영역 왼쪽 위 모서리 바로 위에 붙는다. */
const TAB_HEIGHT = 30;

type GroupLayerProps = {
  document: WorkspaceDocument;
  /** 끌고 있는 노드가 들어갈 그룹(진하게 표시). */
  joinTargetId: string | null;
  /** 멤버 전부가 선택된 그룹(영역 자체를 선택 표시). */
  selectedGroupIds: string[];
  /** 그리기 도구가 켜져 있으면 false: 탭도 입력을 받지 않는다. */
  interactive: boolean;
  onTabPointerDown: (
    event: ReactPointerEvent<HTMLElement>,
    groupId: string,
  ) => void;
  onSelectMembers: (groupId: string) => void;
  onRename: (groupId: string, title: string) => void;
};

/**
 * 노드 그룹 영역과 이름 탭. 영역은 멤버 노드 위치로 계산하고 입력을 받지 않아,
 * 그룹 안 빈 곳은 캔버스와 똑같이 범위 선택이 된다. 탭을 끌면 그룹 전체가 움직인다.
 */
export default function GroupLayer({
  document,
  joinTargetId,
  selectedGroupIds,
  interactive,
  onTabPointerDown,
  onSelectMembers,
  onRename,
}: GroupLayerProps) {
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(
    null,
  );

  /** 이름 입력이 사라진 뒤 그 그룹의 탭으로 포커스를 돌린다(키보드로 끝냈을 때만). */
  function refocusTab(groupId: string) {
    requestAnimationFrame(() =>
      globalThis.document
        .querySelector<HTMLElement>(`[data-group-id="${groupId}"] button`)
        ?.focus({ preventScroll: true }),
    );
  }

  function commit(fromKeyboard = false) {
    if (!editing) return;
    onRename(editing.id, editing.text);
    setEditing(null);
    if (fromKeyboard) refocusTab(editing.id);
  }

  return (
    <>
      {visibleGroups(document).map(({ group, bounds }) => {
        const target = joinTargetId === group.id;
        const chosen = !target && selectedGroupIds.includes(group.id);
        const isEditing = editing?.id === group.id;
        return (
          <div key={group.id} data-group-id={group.id}>
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute rounded-2xl border transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none ${target ? "border-moss-deep bg-moss/20 shadow-[0_0_0_4px_#b6c79440]" : chosen ? "border-2 border-moss-deep bg-moss/10" : "border-moss/40 bg-moss/10"}`}
              style={{
                left: bounds.x,
                top: bounds.y,
                width: bounds.width,
                height: bounds.height,
              }}
            />
            <div
              className={`absolute flex items-center ${interactive ? "" : "pointer-events-none"}`}
              style={{
                left: bounds.x + 14,
                top: bounds.y - TAB_HEIGHT + 1,
                height: TAB_HEIGHT,
                maxWidth: Math.max(80, bounds.width - 28),
              }}
            >
              {isEditing ? (
                <input
                  autoFocus
                  value={editing.text}
                  maxLength={MAX_GROUP_TITLE_LENGTH}
                  aria-label="그룹 이름"
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    setEditing({ id: group.id, text: event.target.value })
                  }
                  onBlur={() => commit()}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.nativeEvent.isComposing || event.keyCode === 229)
                      return;
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commit(true);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      setEditing(null);
                      refocusTab(group.id);
                    }
                  }}
                  className="h-full min-w-24 rounded-t-lg border border-b-0 border-moss-deep bg-white px-3 text-[13px] text-bark outline-none"
                />
              ) : (
                <button
                  type="button"
                  data-keyboard-control=""
                  aria-pressed={chosen}
                  aria-label={`${group.title} 그룹. 끌어서 옮기기, 두 번 눌러 이름 바꾸기, Space로 노드 모두 선택`}
                  title=""
                  onPointerDown={(event) => onTabPointerDown(event, group.id)}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    setEditing({ id: group.id, text: group.title });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.stopPropagation();
                      setEditing({ id: group.id, text: group.title });
                    } else if (event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      onSelectMembers(group.id);
                    }
                  }}
                  className={`h-full max-w-full cursor-grab truncate rounded-t-lg border border-b-0 px-3 text-[13px] font-medium transition-colors duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss-deep active:cursor-grabbing motion-reduce:transition-none ${target || chosen ? "border-moss-deep bg-moss/30 text-bark" : "border-moss/40 bg-moss-wash text-bark-soft hover:bg-moss/25"}`}
                >
                  {group.title}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
