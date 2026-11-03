import type {
  ImageReference,
  NodeTransformPatch,
  WorkspaceDocument,
  WorkspaceNode,
} from "./types";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));
export const NODE_HEADER_HEIGHT = 48;

export function fitNodeSize(
  node: WorkspaceNode,
  canvas: WorkspaceDocument["canvas"],
  requestedWidth: number,
  requestedHeight: number,
  axis: "width" | "height" = "width",
) {
  const maxWidth = canvas.width - node.position.x;
  const maxHeight = canvas.height - node.position.y;
  if (
    node.type === "image_node" &&
    node.image &&
    maxHeight > NODE_HEADER_HEIGHT
  ) {
    const ratio = node.image.width / node.image.height;
    const max = Math.min(maxWidth, (maxHeight - NODE_HEADER_HEIGHT) * ratio);
    const min = Math.min(
      max,
      Math.max(200, (140 - NODE_HEADER_HEIGHT) * ratio),
    );
    const width = clamp(
      axis === "width"
        ? requestedWidth
        : (requestedHeight - NODE_HEADER_HEIGHT) * ratio,
      min,
      max,
    );
    return {
      width,
      height: Math.min(maxHeight, NODE_HEADER_HEIGHT + width / ratio),
    };
  }
  return {
    width: clamp(requestedWidth, Math.min(200, maxWidth), maxWidth),
    height: clamp(requestedHeight, Math.min(140, maxHeight), maxHeight),
  };
}

export function transformNode(
  document: WorkspaceDocument,
  nodeId: string,
  patch: NodeTransformPatch,
): WorkspaceDocument {
  if (Object.values(patch).some((value) => !Number.isFinite(value)))
    return document;
  let changed = false;
  const nodes = document.nodes.map((node) => {
    if (node.id !== nodeId) return node;
    const position = {
      x: clamp(
        patch.x ?? node.position.x,
        0,
        document.canvas.width - node.width,
      ),
      y: clamp(
        patch.y ?? node.position.y,
        0,
        document.canvas.height - node.height,
      ),
    };
    const size =
      patch.width === undefined && patch.height === undefined
        ? { width: node.width, height: node.height }
        : fitNodeSize(
            { ...node, position },
            document.canvas,
            patch.width ?? node.width,
            patch.height ?? node.height,
            patch.width !== undefined ? "width" : "height",
          );
    if (
      position.x === node.position.x &&
      position.y === node.position.y &&
      size.width === node.width &&
      size.height === node.height
    )
      return node;
    changed = true;
    return { ...node, position, ...size };
  });
  return changed ? { ...document, nodes } : document;
}

export function replaceNodeImage(
  document: WorkspaceDocument,
  nodeId: string,
  image: ImageReference | null,
): WorkspaceDocument {
  let changed = false;
  const nodes = document.nodes.map((node) => {
    if (
      node.id !== nodeId ||
      node.type !== "image_node" ||
      node.image === image
    )
      return node;
    changed = true;
    const next = { ...node, image };
    return image
      ? {
          ...next,
          ...fitNodeSize(next, document.canvas, node.width, node.height),
        }
      : next;
  });
  return changed ? { ...document, nodes } : document;
}
