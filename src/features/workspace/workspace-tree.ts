import type { CanvasNode, WorkspaceDocument, WorkspaceNode } from "./types";

export const MAX_CANVAS_DEPTH = 8;
export const MAX_WORKSPACE_NODES = 1000;

export function resolveWorkspacePath(
  root: WorkspaceDocument,
  path: readonly string[],
) {
  let document = root;
  const trail: CanvasNode[] = [];
  for (const id of path) {
    const node = document.nodes.find((candidate) => candidate.id === id);
    if (node?.type !== "canvas_node") break;
    trail.push(node);
    document = node.document;
  }
  return { document, trail };
}

// 변경된 공간과 그 조상만 새 객체로 바꾼다. 삭제된 경로는 건너뛴다.
export function updateWorkspaceAtPath(
  root: WorkspaceDocument,
  path: readonly string[],
  update: (document: WorkspaceDocument) => WorkspaceDocument,
): WorkspaceDocument {
  const [id, ...rest] = path;
  if (id === undefined) return update(root);
  const index = root.nodes.findIndex((node) => node.id === id);
  const node = root.nodes[index];
  if (node?.type !== "canvas_node") return root;
  const document = updateWorkspaceAtPath(node.document, rest, update);
  if (document === node.document) return root;
  const nodes = root.nodes.slice();
  nodes[index] = { ...node, document };
  return { ...root, nodes };
}

export function* walkWorkspaceNodes(
  document: WorkspaceDocument,
): Generator<WorkspaceNode> {
  for (const node of document.nodes) {
    yield node;
    if (node.type === "canvas_node") yield* walkWorkspaceNodes(node.document);
  }
}

export function canvasNodeTitle(node: CanvasNode) {
  return node.title.trim() || "하위 작업 공간";
}

const typeLabel = {
  text_node: "텍스트",
  image_node: "이미지",
  canvas_node: "캔버스",
} as const;

/** 제목이 없는 노드도 목록·스크린리더에서 구분되게 이름을 붙인다. */
export function nodeDisplayName(node: WorkspaceNode) {
  return node.title.trim() || `제목 없는 ${typeLabel[node.type]} 노드`;
}
