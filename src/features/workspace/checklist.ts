import { canHaveRole } from "./roles";
import type {
  ChecklistItem,
  ChecklistNode,
  WorkspaceDocument,
  WorkspaceNode,
} from "./types";
import { updateWorkspaceAtPath } from "./workspace-tree";

/** 체크리스트 하나에 직접 쓸 수 있는 항목 수. */
export const MAX_CHECKLIST_ITEMS = 200;
/** 직접 쓴 항목 글의 최대 길이(앞뒤 공백 제외). */
export const MAX_CHECKLIST_ITEM_LENGTH = 200;

export type ChecklistEntry =
  | { kind: "node"; node: WorkspaceNode; done: boolean }
  | { kind: "item"; item: ChecklistItem };

export type ChecklistView = {
  entries: ChecklistEntry[];
  done: number;
  total: number;
  /** 이어졌지만 역할이 없는 노드(체크리스트 제외). 위치 순. */
  unassignedNodeIds: string[];
};

const byPosition = (a: WorkspaceNode, b: WorkspaceNode) =>
  a.position.y - b.position.y || a.position.x - b.position.x;

/**
 * 체크리스트 목록을 그릴 때마다 계산한다. 같은 공간에서 연결선으로 이어진 할 일 노드(위치 순)
 * 다음에 직접 쓴 항목(추가한 순). 같은 노드와 선이 여러 개여도 한 번만 센다.
 */
export function buildChecklist(
  document: WorkspaceDocument,
  checklistId: string,
): ChecklistView {
  const checklist = document.nodes.find(
    (node): node is ChecklistNode =>
      node.id === checklistId && node.type === "checklist_node",
  );
  if (!checklist)
    return { entries: [], done: 0, total: 0, unassignedNodeIds: [] };

  const linkedIds = new Set<string>();
  for (const connection of document.connections) {
    if (connection.source.nodeId === checklistId)
      linkedIds.add(connection.target.nodeId);
    else if (connection.target.nodeId === checklistId)
      linkedIds.add(connection.source.nodeId);
  }
  linkedIds.delete(checklistId);
  const linked = document.nodes
    .filter((node) => linkedIds.has(node.id))
    .sort(byPosition);

  const entries: ChecklistEntry[] = [];
  const unassignedNodeIds: string[] = [];
  for (const node of linked) {
    if (node.role?.kind === "todo")
      entries.push({ kind: "node", node, done: node.role.done });
    else if (canHaveRole(node)) unassignedNodeIds.push(node.id);
  }
  for (const item of checklist.items) entries.push({ kind: "item", item });

  const done = entries.filter((entry) =>
    entry.kind === "node" ? entry.done : entry.item.done,
  ).length;
  return { entries, done, total: entries.length, unassignedNodeIds };
}

/** 체크리스트 노드 하나의 항목만 바꾼다. 바뀐 게 없으면 같은 문서. */
function updateItems(
  root: WorkspaceDocument,
  path: readonly string[],
  checklistId: string,
  change: (items: ChecklistItem[]) => ChecklistItem[],
): WorkspaceDocument {
  return updateWorkspaceAtPath(root, path, (document) => {
    const index = document.nodes.findIndex(
      (node) => node.id === checklistId && node.type === "checklist_node",
    );
    if (index < 0) return document;
    const node = document.nodes[index] as ChecklistNode;
    const items = change(node.items);
    if (items === node.items) return document;
    const nodes = document.nodes.slice();
    nodes[index] = { ...node, items };
    return { ...document, nodes };
  });
}

const cleanText = (text: string) =>
  text.trim().slice(0, MAX_CHECKLIST_ITEM_LENGTH).trim();

/** 직접 항목을 맨 뒤에 더한다. 빈 글이면 아무 일도 하지 않는다. */
export function addChecklistItem(
  root: WorkspaceDocument,
  path: readonly string[],
  checklistId: string,
  text: string,
  makeId: () => string,
): { document: WorkspaceDocument } | { error: string } {
  const value = cleanText(text);
  if (!value) return { document: root };
  let full = false;
  const document = updateItems(root, path, checklistId, (items) => {
    if (items.length >= MAX_CHECKLIST_ITEMS) {
      full = true;
      return items;
    }
    return [...items, { id: makeId(), text: value, done: false }];
  });
  if (full)
    return {
      error: `항목은 체크리스트마다 ${MAX_CHECKLIST_ITEMS}개까지 넣을 수 있어요.`,
    };
  return { document };
}

/** 직접 항목의 글·완료를 바꾼다. 글을 비우면 항목을 지운다. */
export function editChecklistItem(
  root: WorkspaceDocument,
  path: readonly string[],
  checklistId: string,
  itemId: string,
  patch: { text?: string; done?: boolean },
): WorkspaceDocument {
  return updateItems(root, path, checklistId, (items) => {
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) return items;
    const item = items[index];
    const text = patch.text === undefined ? item.text : cleanText(patch.text);
    if (!text) return items.filter((candidate) => candidate.id !== itemId);
    const done = patch.done ?? item.done;
    if (text === item.text && done === item.done) return items;
    const next = items.slice();
    next[index] = { ...item, text, done };
    return next;
  });
}

export function removeChecklistItem(
  root: WorkspaceDocument,
  path: readonly string[],
  checklistId: string,
  itemId: string,
): WorkspaceDocument {
  return updateItems(root, path, checklistId, (items) =>
    items.some((item) => item.id === itemId)
      ? items.filter((item) => item.id !== itemId)
      : items,
  );
}
