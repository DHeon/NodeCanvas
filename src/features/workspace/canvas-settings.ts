import type { Camera, WorkspaceDocument, WorkspaceNode } from "./types";

export function getNodeBounds(nodes: WorkspaceNode[]) {
  if (!nodes.length) return null;
  return {
    left: Math.min(...nodes.map((node) => node.position.x)),
    top: Math.min(...nodes.map((node) => node.position.y)),
    right: Math.max(...nodes.map((node) => node.position.x + node.width)),
    bottom: Math.max(...nodes.map((node) => node.position.y + node.height)),
  };
}

export function applyCanvasSettings(
  document: WorkspaceDocument,
  canvas: WorkspaceDocument["canvas"],
):
  | { document: WorkspaceDocument; error?: never }
  | { error: string; document?: never } {
  if (
    !Number.isInteger(canvas.width) ||
    !Number.isInteger(canvas.height) ||
    canvas.width < 320 ||
    canvas.height < 240 ||
    canvas.width > 10000 ||
    canvas.height > 10000
  )
    return {
      error: "가로 320~10000, 세로 240~10000 사이의 정수를 입력해주세요.",
    };
  const bounds = getNodeBounds(document.nodes);
  let dx = 0;
  let dy = 0;
  if (!canvas.infinite && bounds) {
    const width = bounds.right - bounds.left;
    const height = bounds.bottom - bounds.top;
    if (width > canvas.width || height > canvas.height)
      return {
        error: `현재 배치를 유지하려면 최소 ${Math.max(320, Math.ceil(width))} × ${Math.max(240, Math.ceil(height))} 크기가 필요합니다.`,
      };
    // 전체 배치를 평행 이동하여 간격·크기·연결 관계를 보존한다.
    dx = Math.max(-bounds.left, Math.min(0, canvas.width - bounds.right));
    dy = Math.max(-bounds.top, Math.min(0, canvas.height - bounds.bottom));
  }
  if (
    canvas.width === document.canvas.width &&
    canvas.height === document.canvas.height &&
    !!canvas.infinite === !!document.canvas.infinite &&
    !dx &&
    !dy
  )
    return { document };
  return {
    document: {
      ...document,
      canvas: { ...canvas, infinite: !!canvas.infinite },
      nodes:
        dx || dy
          ? document.nodes.map((node) => ({
              ...node,
              position: { x: node.position.x + dx, y: node.position.y + dy },
            }))
          : document.nodes,
    },
  };
}

export function getFitCamera(
  document: WorkspaceDocument,
  width: number,
  height: number,
): Camera {
  const bounds = document.canvas.infinite
    ? getNodeBounds(document.nodes)
    : null;
  const left = bounds?.left ?? 0;
  const top = bounds?.top ?? 0;
  const contentWidth = bounds ? bounds.right - left : document.canvas.width;
  const contentHeight = bounds ? bounds.bottom - top : document.canvas.height;
  const zoom = Math.min(
    Math.max(width - 64, 1) / contentWidth,
    Math.max(height - 64, 1) / contentHeight,
    1,
  );
  return {
    x: (width - contentWidth * zoom) / 2 - left * zoom,
    y: (height - contentHeight * zoom) / 2 - top * zoom,
    zoom,
  };
}
