import type { WorkspaceDocument } from "./types";

export function createWorkspace(): WorkspaceDocument {
  return {
    canvas: {
      width: 1600,
      height: 1000,
    },
    nodes: [],
  };
}