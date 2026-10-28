import type { WorkspaceDocument } from "./types";

export const DEFAULT_CANVAS_SIZE = { width: 2000, height: 1200 };

// 기존 기본 크기만 확장한다. 별도로 정한 캔버스 크기와 노드 좌표는 유지한다.
export function expandLegacyCanvas(
  document: WorkspaceDocument,
): WorkspaceDocument {
  if (document.canvas.width !== 1600 || document.canvas.height !== 1000) {
    return document;
  }
  return { ...document, canvas: { ...DEFAULT_CANVAS_SIZE } };
}

export function createWorkspace(): WorkspaceDocument {
  return {
    canvas: {
      ...DEFAULT_CANVAS_SIZE,
    },
    nodes: [],
    connections: [],
  };
}
