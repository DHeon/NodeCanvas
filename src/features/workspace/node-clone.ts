import { v4 as uuidv4 } from "uuid";
import type { NodeConnection, WorkspaceDocument, WorkspaceNode } from "./types";

/** 하위 캔버스까지 모든 노드·연결 ID를 새로 만들어 복제한다(프로젝트 전체 ID 고유 조건). */
function cloneDocument(document: WorkspaceDocument): WorkspaceDocument {
  const ids = new Map<string, string>();
  const nodes = document.nodes.map((node) => {
    const copy = cloneNode(node);
    ids.set(node.id, copy.id);
    return copy;
  });
  return {
    ...document,
    nodes,
    connections: remapConnections(document.connections, ids),
  };
}

function cloneNode(node: WorkspaceNode): WorkspaceNode {
  const base = { ...node, id: uuidv4(), position: { ...node.position } };
  return node.type === "canvas_node"
    ? { ...base, type: "canvas_node", document: cloneDocument(node.document) }
    : (base as WorkspaceNode);
}

function remapConnections(
  connections: NodeConnection[],
  ids: Map<string, string>,
): NodeConnection[] {
  return connections.flatMap((connection) => {
    const source = ids.get(connection.source.nodeId);
    const target = ids.get(connection.target.nodeId);
    return source && target
      ? [
          {
            id: uuidv4(),
            source: { ...connection.source, nodeId: source },
            target: { ...connection.target, nodeId: target },
          },
        ]
      : [];
  });
}

/**
 * 선택한 노드를 offset만큼 옮겨 복제한다. 선택 노드끼리의 연결선도 함께 복제한다.
 * 반환값의 nodes/connections를 현재 공간에 덧붙이면 된다.
 */
export function duplicateNodes(
  document: WorkspaceDocument,
  nodeIds: readonly string[],
  offset: number,
) {
  const ids = new Map<string, string>();
  const nodes: WorkspaceNode[] = [];
  for (const node of document.nodes) {
    if (!nodeIds.includes(node.id)) continue;
    const copy = cloneNode(node);
    copy.position = {
      x: node.position.x + offset,
      y: node.position.y + offset,
    };
    if (!document.canvas.infinite) {
      copy.position.x = Math.max(
        0,
        Math.min(copy.position.x, document.canvas.width - copy.width),
      );
      copy.position.y = Math.max(
        0,
        Math.min(copy.position.y, document.canvas.height - copy.height),
      );
    }
    ids.set(node.id, copy.id);
    nodes.push(copy);
  }
  return { nodes, connections: remapConnections(document.connections, ids) };
}

/** 노드와 그 하위 캔버스에 들어 있는 노드 수(복제 시 전체 제한 확인용). */
export function countNodes(nodes: readonly WorkspaceNode[]): number {
  return nodes.reduce(
    (total, node) =>
      total +
      1 +
      (node.type === "canvas_node" ? countNodes(node.document.nodes) : 0),
    0,
  );
}
