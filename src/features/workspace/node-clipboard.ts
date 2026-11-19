import { v4 as uuidv4 } from "uuid";
import { MAX_CONNECTIONS } from "./connections";
import {
  countDocumentDrawingPoints,
  countNodesDrawingPoints,
  DRAWING_LIMIT_NOTICE,
  MAX_DRAWING_POINTS,
} from "./drawing";
import { groupAtPoint, MAX_GROUPS_PER_CANVAS } from "./groups";
import { cloneNode, countNodes, remapConnections } from "./node-clone";
import type {
  NodeConnection,
  NodeGroup,
  Point,
  WorkspaceDocument,
  WorkspaceNode,
} from "./types";
import {
  MAX_CANVAS_DEPTH,
  MAX_WORKSPACE_NODES,
  resolveWorkspacePath,
  updateWorkspaceAtPath,
  walkWorkspaceNodes,
} from "./workspace-tree";

/** 앱 안 클립보드에 담는 복사 묶음. 노드 ID는 원본 그대로이고 붙여넣을 때 새로 만든다. */
export type NodeClip = {
  nodes: WorkspaceNode[];
  connections: NodeConnection[];
  /** 통째로 고른 그룹. 일부만 고른 그룹의 멤버는 groupId 없이 담는다. */
  groups: NodeGroup[];
  /** 시스템 클립보드에 쓴 글. Ctrl+V가 "나중에 복사한 쪽"을 가릴 때 쓴다. */
  text: string;
  /** 시스템 클립보드 쓰기가 실패했으면 false: Ctrl+V가 글 비교 없이 노드를 붙인다. */
  systemSynced: boolean;
};

export type PasteError = "nodes" | "drawing" | "groups" | "depth" | "size";

/** 붙여넣기를 거절했을 때 알림 문구. */
export const PASTE_ERROR_NOTICES: Record<PasteError, string> = {
  nodes: `노드는 프로젝트 전체에서 ${MAX_WORKSPACE_NODES}개까지 만들 수 있어요.`,
  drawing: DRAWING_LIMIT_NOTICE,
  groups: `그룹은 공간마다 ${MAX_GROUPS_PER_CANVAS}개까지 만들 수 있어요.`,
  depth: `작업 공간은 ${MAX_CANVAS_DEPTH}단계까지 넣을 수 있어요.`,
  size: "붙여넣을 노드들이 이 캔버스보다 커요. 캔버스 크기를 늘린 뒤 붙여넣어 주세요.",
};

/** 멤버가 1개 이상이고 멤버 전부가 선택된 그룹들(문서의 그룹 순서). */
export function selectedGroupIds(
  document: WorkspaceDocument,
  selectedIds: readonly string[],
): string[] {
  if (!document.groups?.length || selectedIds.length === 0) return [];
  const selected = new Set(selectedIds);
  const state = new Map<string, boolean>();
  for (const node of document.nodes) {
    if (!node.groupId) continue;
    state.set(
      node.groupId,
      (state.get(node.groupId) ?? true) && selected.has(node.id),
    );
  }
  return document.groups
    .map((group) => group.id)
    .filter((id) => state.get(id) === true);
}

/** 노드의 제목·본문 글(체크리스트는 항목까지). 다른 프로그램에 붙여넣을 글. */
function nodeText(node: WorkspaceNode): string {
  const parts = [node.title.trim()];
  if ("text" in node && typeof node.text === "string") parts.push(node.text);
  if (node.type === "link_node" && node.url) parts.push(node.url);
  return parts.filter((part) => part.trim()).join("\n");
}

/** 고른 노드로 복사 묶음을 만든다. 고른 노드가 없으면 null. */
export function makeClip(
  document: WorkspaceDocument,
  nodeIds: readonly string[],
): NodeClip | null {
  const ids = new Set(nodeIds);
  const picked = document.nodes.filter((node) => ids.has(node.id));
  if (picked.length === 0) return null;
  const whole = new Set(selectedGroupIds(document, nodeIds));
  const nodes = picked.map((node) => {
    const copy = structuredClone(node);
    if (copy.groupId && !whole.has(copy.groupId)) delete copy.groupId;
    return copy;
  });
  const connections = document.connections
    .filter(
      (connection) =>
        ids.has(connection.source.nodeId) && ids.has(connection.target.nodeId),
    )
    .map((connection) => structuredClone(connection));
  const groups = (document.groups ?? [])
    .filter((group) => whole.has(group.id))
    .map((group) => ({ ...group }));
  const text = [...picked]
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    .map(nodeText)
    .filter(Boolean)
    .join("\n\n");
  return {
    nodes,
    connections,
    groups,
    text: text || `노드 ${picked.length}개`,
    systemSynced: true,
  };
}

/** 노드들이 만드는 캔버스 깊이(캔버스 노드 1단계 = 1). */
function canvasNesting(nodes: readonly WorkspaceNode[]): number {
  let deepest = 0;
  for (const node of nodes) {
    if (node.type === "canvas_node")
      deepest = Math.max(deepest, 1 + canvasNesting(node.document.nodes));
  }
  return deepest;
}

/**
 * 복사 묶음을 path 공간의 point에 붙인다. 묶음 경계 상자의 가운데가 point에 온다.
 * 모든 ID는 새로 만들고, 통째 그룹은 같은 이름의 새 그룹이 된다.
 * 낱개 노드는 point가 기존 그룹 영역 안이면 그 그룹에 들어간다.
 */
export function pasteClip(
  root: WorkspaceDocument,
  path: string[],
  clip: NodeClip,
  point: Point,
): { document: WorkspaceDocument; nodeIds: string[] } | { error: PasteError } {
  const target = resolveWorkspacePath(root, path).document;
  if (path.length + canvasNesting(clip.nodes) > MAX_CANVAS_DEPTH)
    return { error: "depth" };
  if (
    [...walkWorkspaceNodes(root)].length + countNodes(clip.nodes) >
    MAX_WORKSPACE_NODES
  )
    return { error: "nodes" };
  if (
    countDocumentDrawingPoints(root) + countNodesDrawingPoints(clip.nodes) >
    MAX_DRAWING_POINTS
  )
    return { error: "drawing" };
  if ((target.groups?.length ?? 0) + clip.groups.length > MAX_GROUPS_PER_CANVAS)
    return { error: "groups" };

  const joinId = groupAtPoint(target, point);
  const groupIds = new Map(clip.groups.map((group) => [group.id, uuidv4()]));

  // 묶음 가운데를 point로 옮기고, 유한 캔버스면 묶음째 안으로 민다.
  const left = Math.min(...clip.nodes.map((node) => node.position.x));
  const top = Math.min(...clip.nodes.map((node) => node.position.y));
  const right = Math.max(
    ...clip.nodes.map((node) => node.position.x + node.width),
  );
  const bottom = Math.max(
    ...clip.nodes.map((node) => node.position.y + node.height),
  );
  // 유한 캔버스보다 큰 묶음은 어디에 놓아도 영역을 벗어나 저장이 거절되므로 붙이지 않는다.
  if (
    !target.canvas.infinite &&
    (right - left > target.canvas.width || bottom - top > target.canvas.height)
  )
    return { error: "size" };
  let dx = point.x - (left + right) / 2;
  let dy = point.y - (top + bottom) / 2;
  if (!target.canvas.infinite) {
    dx = Math.min(dx, target.canvas.width - right);
    dy = Math.min(dy, target.canvas.height - bottom);
    dx = Math.max(dx, -left);
    dy = Math.max(dy, -top);
  }

  const ids = new Map<string, string>();
  const nodes = clip.nodes.map((node) => {
    const copy = cloneNode(node);
    ids.set(node.id, copy.id);
    copy.position = { x: node.position.x + dx, y: node.position.y + dy };
    const groupId = node.groupId ? groupIds.get(node.groupId) : joinId;
    if (groupId) copy.groupId = groupId;
    else delete copy.groupId;
    return copy;
  });
  const connections = remapConnections(clip.connections, ids);
  const groups = clip.groups.map((group) => ({
    ...group,
    id: groupIds.get(group.id)!,
  }));

  const document = updateWorkspaceAtPath(root, path, (current) => {
    const next: WorkspaceDocument = {
      ...current,
      nodes: [...current.nodes, ...nodes],
      connections: [...current.connections, ...connections].slice(
        0,
        MAX_CONNECTIONS,
      ),
    };
    if (groups.length) next.groups = [...(current.groups ?? []), ...groups];
    return next;
  });
  return { document, nodeIds: nodes.map((node) => node.id) };
}
