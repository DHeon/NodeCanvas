import type {
  NodeGroup,
  Point,
  WorkspaceDocument,
  WorkspaceNode,
} from "./types";
import { updateWorkspaceAtPath } from "./workspace-tree";

/** 공간 하나에 만들 수 있는 그룹 수. */
export const MAX_GROUPS_PER_CANVAS = 200;
/** 그룹 이름 최대 길이(앞뒤 공백 제외). */
export const MAX_GROUP_TITLE_LENGTH = 40;
/** 새 그룹·빈 이름의 기본 이름. */
export const DEFAULT_GROUP_TITLE = "그룹";
/** 그룹 영역이 멤버 노드를 감싸는 여유(캔버스 단위). */
export const GROUP_PADDING = 32;

export type Rect = { x: number; y: number; width: number; height: number };

/** 멤버 노드 사각형의 합집합에 사방 여유를 더한 영역. 멤버가 없으면 null. */
export function groupBounds(
  document: WorkspaceDocument,
  groupId: string,
): Rect | null {
  const members = document.nodes.filter((node) => node.groupId === groupId);
  if (members.length === 0) return null;
  const left = Math.min(...members.map((node) => node.position.x));
  const top = Math.min(...members.map((node) => node.position.y));
  const right = Math.max(
    ...members.map((node) => node.position.x + node.width),
  );
  const bottom = Math.max(
    ...members.map((node) => node.position.y + node.height),
  );
  return {
    x: left - GROUP_PADDING,
    y: top - GROUP_PADDING,
    width: right - left + GROUP_PADDING * 2,
    height: bottom - top + GROUP_PADDING * 2,
  };
}

/** 그릴 그룹들. 멤버 없는 그룹은 뺀다. 목록 순서(나중 것이 위). */
export function visibleGroups(
  document: WorkspaceDocument,
): { group: NodeGroup; bounds: Rect }[] {
  return (document.groups ?? []).flatMap((group) => {
    const bounds = groupBounds(document, group.id);
    return bounds ? [{ group, bounds }] : [];
  });
}

/** 점이 든 그룹 영역. 겹치면 목록 뒤쪽(나중에 만든) 그룹. */
export function groupAtPoint(
  document: WorkspaceDocument,
  point: Point,
): string | null {
  const groups = visibleGroups(document);
  for (let index = groups.length - 1; index >= 0; index--) {
    const { group, bounds } = groups[index];
    if (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    )
      return group.id;
  }
  return null;
}

/** 끌어서 그룹에 넣을 수 있는지. 끄는 노드가 모두 그룹이 없을 때만. */
export function canJoinByDrag(nodes: readonly WorkspaceNode[]): boolean {
  return nodes.length > 0 && nodes.every((node) => !node.groupId);
}

function withoutGroup(node: WorkspaceNode): WorkspaceNode {
  const copy = { ...node };
  delete copy.groupId;
  return copy;
}

/** 멤버 없는 그룹을 목록에서 뺀다. 목록이 비면 필드를 지운다. */
export function pruneEmptyGroups(
  document: WorkspaceDocument,
): WorkspaceDocument {
  if (!document.groups) return document;
  const used = new Set(document.nodes.map((node) => node.groupId));
  const groups = document.groups.filter((group) => used.has(group.id));
  if (groups.length === document.groups.length) return document;
  if (groups.length > 0) return { ...document, groups };
  const copy = { ...document };
  delete copy.groups;
  return copy;
}

/** 지금 공간의 노드들을 새 그룹으로 묶는다. 다른 그룹에 있던 노드는 옮겨온다. */
export function groupNodes(
  root: WorkspaceDocument,
  path: readonly string[],
  nodeIds: readonly string[],
  makeId: () => string,
): { document: WorkspaceDocument; groupId: string } | { error: string } {
  const ids = new Set(nodeIds);
  let error: string | null = null;
  let existing: string | null = null;
  const groupId = makeId();
  const document = updateWorkspaceAtPath(root, path, (current) => {
    const selected = current.nodes.filter((node) => ids.has(node.id));
    if (selected.length === 0) return current;
    // 이미 한 그룹의 멤버 전부를 고른 경우는 그대로 둔다(이름이 "그룹"으로 바뀌지 않게).
    const shared = selected[0].groupId;
    if (
      shared &&
      selected.every((node) => node.groupId === shared) &&
      current.nodes.filter((node) => node.groupId === shared).length ===
        selected.length
    ) {
      existing = shared;
      return current;
    }
    // 옮겨오며 비게 될 그룹을 먼저 빼고 한도를 센다.
    const nodes = current.nodes.map((node) =>
      ids.has(node.id) ? { ...node, groupId } : node,
    );
    const pruned = pruneEmptyGroups({ ...current, nodes });
    if ((pruned.groups?.length ?? 0) >= MAX_GROUPS_PER_CANVAS) {
      error = `그룹은 공간마다 ${MAX_GROUPS_PER_CANVAS}개까지 만들 수 있어요.`;
      return current;
    }
    return {
      ...pruned,
      groups: [
        ...(pruned.groups ?? []),
        { id: groupId, title: DEFAULT_GROUP_TITLE },
      ],
    };
  });
  if (error) return { error };
  if (existing) return { document, groupId: existing };
  return { document, groupId };
}

/** 노드들을 그룹에서 뺀다. 비게 된 그룹은 정리한다. */
export function ungroupNodes(
  root: WorkspaceDocument,
  path: readonly string[],
  nodeIds: readonly string[],
): WorkspaceDocument {
  const ids = new Set(nodeIds);
  return updateWorkspaceAtPath(root, path, (current) => {
    let changed = false;
    const nodes = current.nodes.map((node) => {
      if (!ids.has(node.id) || !node.groupId) return node;
      changed = true;
      return withoutGroup(node);
    });
    return changed ? pruneEmptyGroups({ ...current, nodes }) : current;
  });
}

/** 그룹이 없는 노드만 그 그룹에 넣는다(끌어서 들어가기). */
export function joinGroup(
  root: WorkspaceDocument,
  path: readonly string[],
  nodeIds: readonly string[],
  groupId: string,
): WorkspaceDocument {
  const ids = new Set(nodeIds);
  return updateWorkspaceAtPath(root, path, (current) => {
    if (!current.groups?.some((group) => group.id === groupId)) return current;
    let changed = false;
    const nodes = current.nodes.map((node) => {
      if (!ids.has(node.id) || node.groupId) return node;
      changed = true;
      return { ...node, groupId };
    });
    return changed ? { ...current, nodes } : current;
  });
}

/** 이름을 다듬어 바꾼다. 비면 기본 이름. */
export function renameGroup(
  root: WorkspaceDocument,
  path: readonly string[],
  groupId: string,
  input: string,
): WorkspaceDocument {
  const title =
    input.trim().slice(0, MAX_GROUP_TITLE_LENGTH).trim() || DEFAULT_GROUP_TITLE;
  return updateWorkspaceAtPath(root, path, (current) => {
    const index = current.groups?.findIndex((group) => group.id === groupId);
    if (index === undefined || index < 0) return current;
    const groups = current.groups!;
    if (groups[index].title === title) return current;
    const next = groups.slice();
    next[index] = { ...groups[index], title };
    return { ...current, groups: next };
  });
}
