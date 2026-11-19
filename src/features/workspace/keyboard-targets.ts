// 키보드·휠 입력을 캔버스가 가져갈지, 그 자리의 컨트롤이 받을지 정한다.

const TYPING = "input, textarea, select, [contenteditable='true']";
const CONTROL = "button, a, [role='button'], [role='checkbox']";

/**
 * 스페이스를 그 컨트롤에 넘길지(true) 화면 이동에 쓸지(false).
 * 노드 안의 버튼은 대부분 포인터 전용(연결점·크기 조절)이라 스페이스로 화면을 옮긴다.
 * 키보드로 쓰는 컨트롤은 `data-keyboard-control`로 표시해 스페이스를 넘긴다.
 */
export function spaceBelongsToControl(target: Element | null): boolean {
  if (!target) return false;
  if (target.closest(TYPING)) return true;
  if (!target.closest(CONTROL)) return false;
  return (
    !target.closest("[data-node-id]") ||
    !!target.closest("[data-keyboard-control]")
  );
}

/** 노드 머리에서 Enter/F2로 제목 편집을 시작할지. 머리 안의 버튼에서 누른 키는 그 버튼 몫이다. */
export function startsTitleEdit(
  event: { key: string; target: unknown; currentTarget: unknown },
  editingTitle: boolean,
): boolean {
  return (
    !editingTitle &&
    event.target === event.currentTarget &&
    (event.key === "Enter" || event.key === "F2")
  );
}

/**
 * 휠을 그 자리(입력칸·검색 패널·스크롤 목록)가 받을지. 스크롤 목록은 넘칠 때만 받고,
 * 짧은 목록 위에서는 캔버스 확대·이동이 그대로 된다.
 */
export function wheelStaysInRegion(target: Element | null): boolean {
  if (!target) return false;
  if (
    target.closest(
      "textarea, input, [contenteditable='true'], [data-search-panel]",
    )
  )
    return true;
  const region = target.closest("[data-scroll-region]");
  return !!region && region.scrollHeight > region.clientHeight;
}

/** 목록에서 항목을 지운 뒤 포커스를 옮길 항목. 다음 → 앞 → 없음(null, 추가 입력칸으로). */
export function focusAfterRemoval(
  ids: readonly string[],
  removedId: string,
): string | null {
  const index = ids.indexOf(removedId);
  if (index < 0) return null;
  return ids[index + 1] ?? ids[index - 1] ?? null;
}

const FIELD = "input, textarea, [contenteditable='true']";

/** 글 칸에 고른 글자가 있는지. input/textarea는 선택 범위, 그 밖은 문서 선택으로 본다. */
export function hasSelectedText(field: Element): boolean {
  const range = field as Partial<
    Pick<HTMLTextAreaElement, "selectionStart" | "selectionEnd">
  >;
  if (typeof range.selectionStart === "number")
    return range.selectionStart !== range.selectionEnd;
  if (typeof range.selectionStart === "object") return false;
  return globalThis.getSelection?.()?.isCollapsed === false;
}

/**
 * Ctrl+C/X를 노드 복사·잘라내기로 쓸지(true) 글자에 맡길지(false).
 * 텍스트 노드 본문은 늘 켜져 있는 글 칸이라, 노드 안 글 칸은 고른 글자가 없을 때만 노드용이다.
 */
export function copiesNodes(target: Element | null): boolean {
  const field = target?.closest(FIELD);
  if (!field) return true;
  return !!field.closest("[data-node-id]") && !hasSelectedText(field);
}
