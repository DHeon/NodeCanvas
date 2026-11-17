import type { NodeRole, WorkspaceDocument, WorkspaceNode } from "./types";
import { updateWorkspaceAtPath } from "./workspace-tree";

/** 체크리스트 노드는 역할을 가질 수 없다(집계하는 쪽이므로). */
export function canHaveRole(node: WorkspaceNode): boolean {
  return node.type !== "checklist_node";
}

/** 역할 필드를 뺀 노드. 빈 역할을 저장하지 않으려고 필드 자체를 지운다. */
function withoutRole(node: WorkspaceNode): WorkspaceNode {
  const copy = { ...node };
  delete copy.role;
  return copy;
}

/** 노드 한 개만 바꾸는 갱신. 바뀐 게 없으면 같은 문서를 돌려준다. */
function mapNodes(
  root: WorkspaceDocument,
  path: readonly string[],
  change: (node: WorkspaceNode) => WorkspaceNode,
): WorkspaceDocument {
  return updateWorkspaceAtPath(root, path, (document) => {
    let changed = false;
    const nodes = document.nodes.map((node) => {
      const next = change(node);
      if (next !== node) changed = true;
      return next;
    });
    return changed ? { ...document, nodes } : document;
  });
}

/**
 * 지금 공간의 노드들에 역할을 정한다. 체크리스트는 건너뛴다.
 * "todo"는 이미 할 일이면 완료 상태를 그대로 두고, null은 역할을 지운다.
 */
export function setRole(
  root: WorkspaceDocument,
  path: readonly string[],
  nodeIds: readonly string[],
  role: "todo" | null,
): WorkspaceDocument {
  const ids = new Set(nodeIds);
  return mapNodes(root, path, (node) => {
    if (!ids.has(node.id) || !canHaveRole(node)) return node;
    if (role === null) return node.role ? withoutRole(node) : node;
    if (node.role?.kind === "todo") return node;
    return { ...node, role: { kind: "todo", done: false } };
  });
}

/** 할 일 노드의 완료 상태를 바꾼다. 할 일이 아니면 그대로. */
export function setTodoDone(
  root: WorkspaceDocument,
  path: readonly string[],
  nodeId: string,
  done: boolean,
): WorkspaceDocument {
  return mapNodes(root, path, (node) =>
    node.id === nodeId && node.role?.kind === "todo" && node.role.done !== done
      ? { ...node, role: { ...node.role, done } }
      : node,
  );
}

/** 이어서 만들기로 생기는 노드의 역할. 체크리스트에서 이어 만들면 할 일이 된다. */
export function roleForConnectedNode(
  sources: readonly WorkspaceNode[],
  type: WorkspaceNode["type"],
): NodeRole | undefined {
  if (type === "checklist_node") return undefined;
  return sources.some((node) => node.type === "checklist_node")
    ? { kind: "todo", done: false }
    : undefined;
}
